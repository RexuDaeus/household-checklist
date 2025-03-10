"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SumikkoHeader } from "@/components/sumikko-header"
import { SumikkoCard } from "@/components/sumikko-card"
import { supabase } from "@/lib/supabase"
import type { Bill, Profile } from "@/lib/supabase"
import { format } from "date-fns"
import { RefreshCcw, RefreshCw, Trash, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"

export default function ArchivedBillsPage() {
  const [archivedBills, setArchivedBills] = useState<Bill[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        console.log("Loading archived bills...");
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
          console.log("Current user:", profile);

          // Get all users
          const { data: fetchedUsers } = await supabase
            .from("profiles")
            .select("*")

          if (fetchedUsers) {
            setAllUsers(fetchedUsers)
          }

          // First, check if the archived_bills table exists by listing tables
          const { data: tableList, error: tableListError } = await supabase
            .from('pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');
            
          if (tableListError) {
            console.error("Error checking tables:", tableListError);
          } else {
            console.log("Available tables:", tableList);
          }

          // Attempt to get archived bills
          console.log("Querying archived bills...");
          const { data: archivedBillsData, error: queryError } = await supabase
            .from("archived_bills")
            .select("*");
            
          if (queryError) {
            console.error("Error fetching archived bills:", queryError);
            alert("Error fetching archived bills: " + queryError.message);
            setIsLoading(false);
            return;
          }
          
          console.log("Raw archived bills data:", archivedBillsData);

          if (archivedBillsData && archivedBillsData.length > 0) {
            // Now filter for the user's bills
            const userBills = archivedBillsData.filter(
              record => record.payer_id === session.user.id || 
                        (record.bill_data && record.bill_data.created_by === session.user.id)
            );
            
            console.log("User's archived bills:", userBills);
            
            // Extract the bill_data from each archived bill record and add the record id
            const bills = userBills.map(record => ({
              ...record.bill_data as Bill,
              archived_record_id: record.id,
              payer_id: record.payer_id
            }));
            
            console.log("Processed bills for display:", bills);
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

  const handleDeleteBill = async (bill: Bill) => {
    if (!confirm(`Are you sure you want to permanently delete this bill: ${bill.title}?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      // Delete the archived bill record
      const { error } = await supabase
        .from("archived_bills")
        .delete()
        .eq("id", bill.archived_record_id);
      
      if (error) {
        throw new Error(`Error deleting archived bill: ${error.message}`);
      }
      
      // Update UI
      setArchivedBills(prev => prev.filter(b => b.archived_record_id !== bill.archived_record_id));
      alert("Bill permanently deleted.");
    } catch (error) {
      console.error("Error deleting bill:", error);
      alert("Failed to delete bill: " + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllForPayer = async (payerId: string) => {
    const billsToDelete = archivedBills.filter(bill => bill.payer_id === payerId);
    if (billsToDelete.length === 0) return;
    
    if (!confirm(`Are you sure you want to permanently delete all ${billsToDelete.length} bills for ${getUsernameById(payerId)}?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      // Get all archived record IDs
      const archivedIds = billsToDelete.map(bill => bill.archived_record_id);
      
      // Delete all records in one query
      const { error } = await supabase
        .from("archived_bills")
        .delete()
        .in('id', archivedIds);
      
      if (error) {
        throw new Error(`Error deleting archived bills: ${error.message}`);
      }
      
      // Update UI
      setArchivedBills(prev => prev.filter(bill => !archivedIds.includes(bill.archived_record_id!)));
      alert(`Successfully deleted all bills for ${getUsernameById(payerId)}`);
    } catch (error) {
      console.error("Error deleting all bills:", error);
      alert("Failed to delete bills: " + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllArchived = async () => {
    if (archivedBills.length === 0) return;
    
    setDeleteConfirmation("");

    if (confirm(`Are you sure you want to permanently delete ALL archived bills? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        // Delete all archived records
        const { error } = await supabase
          .from("archived_bills")
          .delete()
          .gte('id', 0); // Delete all records
        
        if (error) {
          throw new Error(`Error deleting all archived bills: ${error.message}`);
        }
        
        // Update UI
        setArchivedBills([]);
        alert("All archived bills have been permanently deleted.");
      } catch (error) {
        console.error("Error deleting all archived bills:", error);
        alert("Failed to delete all bills: " + (error as Error).message);
      } finally {
        setIsDeleting(false);
      }
    }
  };

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
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4 py-2">
        <SumikkoHeader showBackButton />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Archived Bills</h1>
          <Button
            variant="outline"
            onClick={() => router.push("/bills")}
            className="flex items-center gap-2"
          >
            Back to Bills
          </Button>
        </div>

        {archivedBills.length === 0 ? (
          <div className="bg-secondary/30 rounded-lg p-8 text-center">
            <p className="text-lg text-muted-foreground">No archived bills found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(getArchivedBillsByPayer()).map(([payerId, bills]) => (
              <SumikkoCard
                key={payerId}
                title={
                  <div className="flex justify-between w-full items-center flex-wrap gap-2">
                    <div>Bills paid by {getUsernameById(payerId)}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRestoreAllForPayer(payerId)}
                        disabled={isRestoring || isDeleting}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Restore All
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteAllForPayer(payerId)}
                        disabled={isRestoring || isDeleting}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <Trash className="h-4 w-4" />
                        Delete All
                      </Button>
                    </div>
                  </div>
                }
              >
                <ul className="space-y-4">
                  {bills.map((bill) => (
                    <li key={bill.archived_record_id} className="sumikko-list-item">
                      <div className="flex items-center justify-between w-full flex-wrap gap-2">
                        <div className="flex-grow">
                          <div className="font-medium flex items-baseline justify-between flex-wrap gap-2">
                            <span className="text-base">{bill.title}</span>
                            <span className="text-lg font-semibold text-secondary-foreground">${parseFloat(bill.amount.toString()).toFixed(2)}</span>
                          </div>
                          <div className="text-muted-foreground">
                            Date: {format(new Date(bill.due_date), "PPP")}
                          </div>
                          <div className="text-muted-foreground">
                            Paid on: {format(new Date(bill.archived_at || bill.created_at), "PPP")}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreBill(bill)}
                            disabled={isRestoring || isDeleting}
                            className="flex items-center gap-1 whitespace-nowrap flex-1 sm:flex-auto"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteBill(bill)}
                            disabled={isRestoring || isDeleting}
                            className="flex items-center gap-1 whitespace-nowrap flex-1 sm:flex-auto"
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </SumikkoCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 