"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SumikkoHeader } from "@/components/sumikko-header"
import { SumikkoCard } from "@/components/sumikko-card"
import { supabase } from "@/lib/supabase"
import type { Bill, Profile } from "@/lib/supabase"
import { format } from "date-fns"
import { RefreshCcw, RefreshCw } from "lucide-react"

export default function ArchivedBillsPage() {
  const [archivedBills, setArchivedBills] = useState<Bill[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/login")
          return
        }

        // Get current user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setCurrentUser(profile)

          // Get all users
          const { data: fetchedUsers } = await supabase
            .from("profiles")
            .select("*")

          if (fetchedUsers) {
            setAllUsers(fetchedUsers)
          }

          // First, check if the archived_bills table exists
          const { error: tableError } = await supabase
            .from('archived_bills')
            .select('count')
            .limit(1)
            .single();

          // If the table doesn't exist or there's an error, we need to create it
          if (tableError) {
            console.error("Error checking archived_bills table:", tableError);
            alert("The archived_bills table may not exist. Please run the SQL script to create it.");
            setIsLoading(false);
            return;
          }

          // Get archived bills where user is creator or was a payer
          const { data: archivedBillsData, error: queryError } = await supabase
            .from("archived_bills")
            .select("*")
            .or(`payer_id.eq.${session.user.id},bill_data->>'created_by'.eq.${session.user.id}`)
            .order("archived_at", { ascending: false });

          if (queryError) {
            console.error("Error fetching archived bills:", queryError);
            alert("Failed to load archived bills.");
            setIsLoading(false);
            return;
          }

          if (archivedBillsData && archivedBillsData.length > 0) {
            // Extract the bill_data from each archived bill record and add the record id
            const bills = archivedBillsData.map(record => ({
              ...record.bill_data as Bill,
              archived_record_id: record.id,
              payer_id: record.payer_id
            }));
            setArchivedBills(bills);
          } else {
            console.log("No archived bills found");
          }
        }
      } catch (error) {
        console.error("Error loading archived bills:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const getUsernameById = (userId: string): string => {
    if (userId === currentUser?.id) return `${currentUser.username} (You)`;
    const user = allUsers.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
  }

  // Group archived bills by payer
  const getArchivedBillsByPayer = () => {
    const billsByPayer: Record<string, Bill[]> = {};
    
    archivedBills.forEach(bill => {
      const payerId = bill.payer_id as string;
      if (!billsByPayer[payerId]) {
        billsByPayer[payerId] = [];
      }
      billsByPayer[payerId].push(bill);
    });
    
    return billsByPayer;
  }

  const handleRestoreBill = async (bill: Bill) => {
    if (!bill.archived_record_id) return;
    
    setIsRestoring(true);
    try {
      // Get the archived bill record
      const { data: archivedRecord } = await supabase
        .from("archived_bills")
        .select("*")
        .eq("id", bill.archived_record_id)
        .single();
      
      if (!archivedRecord) {
        throw new Error("Archived bill record not found");
      }

      // Prepare the bill to be restored
      const billToRestore = { ...bill };
      delete (billToRestore as any).archived_record_id;
      delete (billToRestore as any).payer_id;
      delete billToRestore.archived_at;

      // First check if the original bill still exists
      const { data: existingBill } = await supabase
        .from("bills")
        .select("*")
        .eq("id", bill.id)
        .single();

      if (existingBill) {
        // Bill exists, update its payers array to include this payer
        const updatedPayers = [...existingBill.payers];
        if (!updatedPayers.includes(archivedRecord.payer_id)) {
          updatedPayers.push(archivedRecord.payer_id);
          
          // Update the bill
          const { error: updateError } = await supabase
            .from("bills")
            .update({ payers: updatedPayers })
            .eq("id", bill.id);
          
          if (updateError) {
            throw new Error(`Error updating bill: ${updateError.message}`);
          }
        }
      } else {
        // Bill doesn't exist, create a new one
        const { error: insertError } = await supabase
          .from("bills")
          .insert([billToRestore]);
        
        if (insertError) {
          throw new Error(`Error creating bill: ${insertError.message}`);
        }
      }

      // Delete the archived record
      const { error: deleteError } = await supabase
        .from("archived_bills")
        .delete()
        .eq("id", bill.archived_record_id);
      
      if (deleteError) {
        throw new Error(`Error deleting archived record: ${deleteError.message}`);
      }

      // Update the UI
      setArchivedBills(prev => prev.filter(b => b.archived_record_id !== bill.archived_record_id));
    } catch (error) {
      console.error("Error restoring bill:", error);
      alert("Failed to restore bill: " + (error as Error).message);
    } finally {
      setIsRestoring(false);
    }
  }

  const handleRestoreAllForPayer = async (payerId: string) => {
    const billsToRestore = archivedBills.filter(bill => bill.payer_id === payerId);
    if (billsToRestore.length === 0) return;
    
    if (!confirm(`Restore all ${billsToRestore.length} bills for ${getUsernameById(payerId)}?`)) {
      return;
    }
    
    setIsRestoring(true);
    try {
      // Process each bill
      for (const bill of billsToRestore) {
        await handleRestoreBill(bill);
      }
      
      alert(`Successfully restored all bills for ${getUsernameById(payerId)}`);
    } catch (error) {
      console.error("Error restoring all bills:", error);
      alert("Failed to restore all bills: " + (error as Error).message);
    } finally {
      setIsRestoring(false);
    }
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen">
        <SumikkoHeader showBackButton />
        <div className="max-w-7xl mx-auto px-4">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const archivedBillsByPayer = getArchivedBillsByPayer();

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Archived Bills</h1>
          <Button 
            variant="outline"
            onClick={() => router.push("/bills")}
          >
            Back to Active Bills
          </Button>
        </div>

        {Object.keys(archivedBillsByPayer).length === 0 ? (
          <p className="text-muted-foreground">No archived bills found.</p>
        ) : (
          <div className="space-y-10">
            {Object.entries(archivedBillsByPayer).map(([payerId, bills]) => {
              const payerName = getUsernameById(payerId);
              return (
                <div key={payerId} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-medium">Archived bills for {payerName}</h3>
                    {currentUser.id === bills[0].created_by && (
                      <Button 
                        variant="outline"
                        onClick={() => handleRestoreAllForPayer(payerId)}
                        disabled={isRestoring}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Restore All
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {bills.map((bill) => (
                      <SumikkoCard
                        key={bill.archived_record_id}
                        title={bill.title}
                        subtitle={`Archived on ${format(new Date(bill.archived_at || ""), "PPP")}`}
                        titleExtra={
                          currentUser.id === bill.created_by && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRestoreBill(bill)}
                              disabled={isRestoring}
                              className="flex items-center gap-1"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          )
                        }
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="font-medium">${bill.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Due Date:</span>
                            <span>{format(new Date(bill.due_date), "PPP")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created By:</span>
                            <span>{getUsernameById(bill.created_by)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payee:</span>
                            <span>{getUsernameById(bill.payee || "")}</span>
                          </div>
                        </div>
                      </SumikkoCard>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
} 