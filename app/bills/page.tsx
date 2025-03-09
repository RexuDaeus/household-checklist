"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash, Edit, Save, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SumikkoHeader } from "@/components/sumikko-header"
import { SumikkoCard } from "@/components/sumikko-card"
import { supabase } from "@/lib/supabase"
import type { Bill, Profile } from "@/lib/supabase"
import { format } from "date-fns"

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [newBillName, setNewBillName] = useState("")
  const [newBillAmount, setNewBillAmount] = useState("")
  const [newBillPayee, setNewBillPayee] = useState("")
  const [newBillDate, setNewBillDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingBill, setEditingBill] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    title: string;
    amount: string;
    payee: string;
    due_date: string;
  }>({
    title: "",
    amount: "",
    payee: "",
    due_date: ""
  })
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

          // Get all users (including current user for bills)
          const { data: fetchedUsers } = await supabase
            .from("profiles")
            .select("*")

          if (fetchedUsers) {
            setAllUsers(fetchedUsers);
            // Filter out the current user for the UI list
            setUsers(fetchedUsers.filter(user => user.id !== session.user.id))
          }

          // Get all bills where user is creator or payer
          const { data: userBills } = await supabase
            .from("bills")
            .select("*")
            .or(`created_by.eq.${session.user.id},payers.cs.{${session.user.id}}`)
            .order("created_at", { ascending: false })

          if (userBills) {
            setBills(userBills)
          }

          // Set up real-time subscription for bills with user ID available
          const userId = session.user.id;
          const channel = supabase
            .channel("bills-channel-" + Date.now()) // Use unique channel name
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "bills"
              },
              (payload) => {
                console.log("Realtime payload received for bills:", payload);
                
                // For INSERT events, check if it's relevant to the user and add it
                if (payload.eventType === 'INSERT') {
                  console.log("New bill received:", payload.new);
                  const newBill = payload.new as Bill;
                  // Only add if the bill is created by the user or the user is a payer
                  if (newBill.created_by === userId || (newBill.payers && newBill.payers.includes(userId))) {
                    console.log("Adding new bill to state");
                    setBills(prevBills => [newBill, ...prevBills]);
                  }
                } 
                // For UPDATE events, update the existing bill
                else if (payload.eventType === 'UPDATE') {
                  console.log("Updating bill in state:", payload.new);
                  setBills(prevBills => 
                    prevBills.map(bill => 
                      bill.id === payload.new.id ? payload.new as Bill : bill
                    )
                  );
                }
                // For DELETE events, remove the bill
                else if (payload.eventType === 'DELETE') {
                  console.log("Removing bill from state:", payload.old);
                  setBills(prevBills => 
                    prevBills.filter(bill => bill.id !== payload.old.id)
                  );
                }
              }
            )
            .subscribe((status) => {
              console.log("Bills channel subscription status:", status);
            });

          // Save channel to be unsubscribed on cleanup
          return () => {
            console.log("Unsubscribing from bills channel");
            channel.unsubscribe();
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleNewBill = async () => {
    if (!newBillName || !newBillAmount || !newBillPayee || selectedPayers.length === 0 || !currentUser) return

    try {
      // Ensure we include the current user in payers if they should be part of the bill
      const payersIncludingCreator = [...selectedPayers];
      if (!payersIncludingCreator.includes(currentUser.id)) {
        payersIncludingCreator.push(currentUser.id);
      }

      const newBill = {
        title: newBillName,
        amount: parseFloat(newBillAmount),
        payee: newBillPayee,
        payers: payersIncludingCreator,
        created_by: currentUser.id,
        due_date: new Date(newBillDate).toISOString(),
        created_at: new Date().toISOString()
      };

      console.log("Creating new bill:", newBill);

      // Optimistically update UI first
      const tempId = Date.now().toString();
      const tempBill: Bill = {
        id: tempId,
        ...newBill
      };
      
      setBills(prevBills => [tempBill, ...prevBills]);

      // Then send to database
      const { data, error } = await supabase
        .from("bills")
        .insert([newBill])
        .select();

      if (error) {
        console.error("Supabase error adding bill:", error);
        // Keep the temporary bill in place with a note that it's not synced
        alert("Bill added locally. Note: Database sync failed, but bill is visible for this session.");
      } else {
        console.log("Bill added successfully to database:", data);
        // If the database insertion was successful, replace the temp bill
        // with the real one that has the proper ID from the database
        if (data && data.length > 0) {
          setBills(prevBills => {
            return prevBills.map(bill => 
              bill.id === tempId ? data[0] : bill
            );
          });
        }
      }

      setNewBillName("");
      setNewBillAmount("");
      setNewBillPayee("");
      setNewBillDate(format(new Date(), "yyyy-MM-dd"));
      setSelectedPayers([]);
    } catch (error) {
      console.error("Error adding bill:", error);
      alert("Failed to add bill. Please check the console for details.");
    }
  }

  const handleDeleteBill = async (id: string) => {
    try {
      // Update UI optimistically
      setBills(prevBills => prevBills.filter(bill => bill.id !== id));
      
      console.log(`Optimistically deleted bill ${id}`);
      
      // Then delete from database
      const { error } = await supabase
        .from("bills")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting bill:", error);
        alert("Failed to delete on the server. The item may reappear if you reload.");
      } else {
        console.log("Successfully deleted bill from database");
      }
    } catch (error) {
      console.error("Error deleting bill:", error);
    }
  }

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill.id);
    setEditFormData({
      title: bill.title,
      amount: bill.amount.toString(),
      payee: bill.payee || "",
      due_date: format(new Date(bill.due_date), "yyyy-MM-dd")
    });
  }

  const handleCancelEdit = () => {
    setEditingBill(null);
  }

  const handleSaveEdit = async (billId: string, payers: string[]) => {
    try {
      const updatedBill = {
        title: editFormData.title,
        amount: parseFloat(editFormData.amount),
        payee: editFormData.payee,
        due_date: new Date(editFormData.due_date).toISOString(),
      };

      // Update UI optimistically
      setBills(prevBills => prevBills.map(bill => 
        bill.id === billId ? { ...bill, ...updatedBill } : bill
      ));
      
      // Then update in database
      const { error } = await supabase
        .from("bills")
        .update(updatedBill)
        .eq("id", billId);

      if (error) {
        console.error("Error updating bill:", error);
        alert("Failed to update on the server. Changes may not persist if you reload.");
      } else {
        console.log("Successfully updated bill in database");
      }
      
      // Reset editing state
      setEditingBill(null);
    } catch (error) {
      console.error("Error updating bill:", error);
      alert("Failed to update bill. Please check the console for details.");
    }
  }

  const togglePayer = (payerId: string) => {
    setSelectedPayers(prev => 
      prev.includes(payerId)
        ? prev.filter(id => id !== payerId)
        : [...prev, payerId]
    )
  }

  const togglePayee = (payeeId: string) => {
    setNewBillPayee(prev => prev === payeeId ? "" : payeeId);
  }

  const getAmountPerPerson = (amount: number, payersCount: number) => {
    if (payersCount === 0) return "0.00"
    return (amount / payersCount).toFixed(2)
  }

  const getUsernameById = (userId: string): string => {
    if (userId === currentUser?.id) return `${currentUser.username} (You)`;
    const user = allUsers.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
  }

  // Calculate total for a group of bills
  const calculateGroupTotal = (billsGroup: Bill[]): string => {
    const total = billsGroup.reduce((sum, bill) => sum + bill.amount, 0);
    return total.toFixed(2);
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

  // Group bills by payee instead of creator
  const billsByPayee = bills.reduce((acc, bill) => {
    const payeeKey = bill.payee || "Unspecified";
    if (!acc[payeeKey]) {
      acc[payeeKey] = [];
    }
    acc[payeeKey].push(bill);
    return acc;
  }, {} as Record<string, Bill[]>);

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <SumikkoCard
          title="Add New Bill"
          subtitle="Create a new bill and select who needs to pay"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="billName">Bill Name</Label>
              <Input
                id="billName"
                className="sumikko-input"
                value={newBillName}
                onChange={(e) => setNewBillName(e.target.value)}
                placeholder="Enter bill name"
              />
            </div>
            <div className="space-y-2">
              <Label>Select Payee</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select who the bill is paid to (only one selection allowed)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`payee-${currentUser.id}`}
                    checked={newBillPayee === currentUser.id}
                    onCheckedChange={() => togglePayee(currentUser.id)}
                    className="sumikko-checkbox"
                  />
                  <Label 
                    htmlFor={`payee-${currentUser.id}`}
                    className="text-sm font-medium"
                  >
                    {currentUser.username} (You)
                  </Label>
                </div>
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`payee-${user.id}`}
                      checked={newBillPayee === user.id}
                      onCheckedChange={() => togglePayee(user.id)}
                      className="sumikko-checkbox"
                    />
                    <Label 
                      htmlFor={`payee-${user.id}`}
                      className="text-sm font-medium"
                    >
                      {user.username}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Total Amount ($)</Label>
              <Input
                id="amount"
                className="sumikko-input"
                type="number"
                step="0.01"
                min="0"
                value={newBillAmount}
                onChange={(e) => setNewBillAmount(e.target.value)}
                placeholder="Enter total amount"
              />
              {newBillAmount && selectedPayers.length >= 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ${getAmountPerPerson(parseFloat(newBillAmount), selectedPayers.length)} each
                  (split between {selectedPayers.length} payer{selectedPayers.length !== 1 ? 's' : ''})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billDate">Bill Received On</Label>
              <Input
                id="billDate"
                className="sumikko-input"
                type="date"
                value={newBillDate}
                onChange={(e) => setNewBillDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Payers</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select who needs to pay this bill (including yourself if applicable)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`payer-${currentUser.id}`}
                    checked={selectedPayers.includes(currentUser.id)}
                    onCheckedChange={() => togglePayer(currentUser.id)}
                    className="sumikko-checkbox"
                  />
                  <Label 
                    htmlFor={`payer-${currentUser.id}`}
                    className="text-sm font-medium"
                  >
                    {currentUser.username} (You)
                  </Label>
                </div>
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`payer-${user.id}`}
                      checked={selectedPayers.includes(user.id)}
                      onCheckedChange={() => togglePayer(user.id)}
                      className="sumikko-checkbox"
                    />
                    <Label 
                      htmlFor={`payer-${user.id}`}
                      className="text-sm font-medium"
                    >
                      {user.username}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button 
              className="w-full sumikko-button"
              onClick={handleNewBill}
              disabled={!newBillName || !newBillAmount || !newBillPayee || selectedPayers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </SumikkoCard>

        {Object.entries(billsByPayee).map(([payee, payeeBills]) => {
          // Find the user name if payee is a user ID
          let payeeDisplayName = payee;
          if (payee !== "Unspecified") {
            const foundUser = allUsers.find(user => user.id === payee);
            if (foundUser) {
              payeeDisplayName = foundUser.username;
              if (foundUser.id === currentUser.id) {
                payeeDisplayName += " (You)";
              }
            }
          }
          
          // Calculate the total for this group of bills
          const groupTotal = calculateGroupTotal(payeeBills);
          
          return (
            <SumikkoCard
              key={payee}
              title={`Bills for ${payeeDisplayName}`}
              subtitle={`Total: $${groupTotal} • ${payeeBills.length} bill${payeeBills.length !== 1 ? 's' : ''}`}
            >
              <ul className="space-y-4">
                {payeeBills.map((bill) => (
                  <li key={bill.id} className="sumikko-list-item">
                    {editingBill === bill.id ? (
                      // Edit form
                      <div className="w-full space-y-3">
                        <Input
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          placeholder="Bill title"
                          className="w-full"
                        />
                        <div className="space-y-2">
                          <Label>Select Payee (Edit)</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-payee-${currentUser.id}`}
                                checked={editFormData.payee === currentUser.id}
                                onCheckedChange={() => setEditFormData({
                                  ...editFormData,
                                  payee: editFormData.payee === currentUser.id ? "" : currentUser.id
                                })}
                                className="sumikko-checkbox"
                              />
                              <Label 
                                htmlFor={`edit-payee-${currentUser.id}`}
                                className="text-sm font-medium"
                              >
                                {currentUser.username} (You)
                              </Label>
                            </div>
                            {users.map((user) => (
                              <div key={user.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-payee-${user.id}`}
                                  checked={editFormData.payee === user.id}
                                  onCheckedChange={() => setEditFormData({
                                    ...editFormData,
                                    payee: editFormData.payee === user.id ? "" : user.id
                                  })}
                                  className="sumikko-checkbox"
                                />
                                <Label 
                                  htmlFor={`edit-payee-${user.id}`}
                                  className="text-sm font-medium"
                                >
                                  {user.username}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.amount}
                          onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                          placeholder="Amount"
                          className="w-full"
                        />
                        <Input
                          type="date"
                          value={editFormData.due_date}
                          onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                          className="w-full"
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(bill.id, bill.payers)}
                          >
                            <Save className="h-4 w-4 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex-grow">
                          <div className="font-medium flex items-baseline">
                            <span>{bill.title}</span>
                            <span className="ml-2 text-sm text-muted-foreground">${bill.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Per person: ${getAmountPerPerson(bill.amount, bill.payers.length)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Received on: {format(new Date(bill.due_date), "PPP")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Created by: {getUsernameById(bill.created_by)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Payers: {bill.payers.map(id => getUsernameById(id)).join(", ")}
                          </div>
                        </div>
                        {bill.created_by === currentUser.id && (
                          <div className="flex space-x-2">
                            <Button
                              className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
                              onClick={() => handleEditBill(bill)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              className={buttonVariants({ variant: "destructive", size: "sm", className: "rounded-full" })}
                              onClick={() => handleDeleteBill(bill.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SumikkoCard>
          );
        })}
      </div>
    </div>
  )
} 