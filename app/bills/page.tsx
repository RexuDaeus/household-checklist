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

  // Separate bills where the current user is the payee
  const myBillsAsPayee = billsByPayee[currentUser.id] || [];
  
  // Group my bills as payee by payers
  const myBillsByPayer = myBillsAsPayee.reduce((acc, bill) => {
    bill.payers.forEach(payerId => {
      if (payerId !== currentUser.id) { // Don't group by yourself
        if (!acc[payerId]) {
          acc[payerId] = [];
        }
        acc[payerId].push(bill);
      }
    });
    return acc;
  }, {} as Record<string, Bill[]>);
  
  // All other bills grouped by payee
  const otherBillsByPayee = { ...billsByPayee };
  if (currentUser.id in otherBillsByPayee) {
    delete otherBillsByPayee[currentUser.id];
  }

  // Calculate per person total for a bill
  const getPerPersonTotal = (bill: Bill): string => {
    return getAmountPerPerson(bill.amount, bill.payers.length);
  };

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
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
              <Label htmlFor="billDate">Bill Date</Label>
              <Input
                id="billDate"
                className="sumikko-input"
                type="date"
                value={newBillDate}
                onChange={(e) => setNewBillDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Payee</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select who the bill is paid to
              </p>
              <select 
                className="sumikko-input w-full p-2 rounded-md border border-input"
                value={newBillPayee}
                onChange={(e) => setNewBillPayee(e.target.value)}
              >
                <option value="">Select a payee</option>
                <option value={currentUser.id}>{currentUser.username} (You)</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.username}</option>
                ))}
              </select>
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

        {/* Your Bills (where you are the payee) */}
        {myBillsAsPayee.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Money Owed to You 
              <span className="ml-2 text-lg font-semibold text-secondary">
                ${calculateGroupTotal(myBillsAsPayee)} • {myBillsAsPayee.length} bill{myBillsAsPayee.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(myBillsByPayer).map(([payerId, payerBills]) => {
                const payerName = getUsernameById(payerId);
                const groupTotal = calculateGroupTotal(payerBills);
                
                return (
                  <SumikkoCard
                    key={payerId}
                    title={`Owed by ${payerName}`}
                    subtitle={`$${groupTotal} total • ${payerBills.length} bill${payerBills.length !== 1 ? 's' : ''}`}
                  >
                    <ul className="space-y-4">
                      {payerBills.map((bill) => (
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
                                <select 
                                  className="w-full p-2 rounded-md border border-input"
                                  value={editFormData.payee}
                                  onChange={(e) => setEditFormData({
                                    ...editFormData,
                                    payee: e.target.value
                                  })}
                                >
                                  <option value="">Select a payee</option>
                                  <option value={currentUser.id}>{currentUser.username} (You)</option>
                                  {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.username}</option>
                                  ))}
                                </select>
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
                                <div className="font-medium flex items-baseline justify-between">
                                  <span className="text-base">{bill.title}</span>
                                  <span className="ml-2 text-lg font-semibold text-secondary-foreground">${bill.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between mt-2">
                                  <div className="text-muted-foreground">
                                    Date: {format(new Date(bill.due_date), "PPP")}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Per person: </span>
                                    <span className="text-base">${getAmountPerPerson(bill.amount, bill.payers.length)}</span>
                                  </div>
                                </div>
                                <div className="text-muted-foreground">
                                  Created by: {getUsernameById(bill.created_by)}
                                </div>
                                <div className="text-sm font-medium mt-1 bg-secondary/10 p-1 rounded">
                                  <span className="font-semibold">Payers: </span>
                                  {bill.payers.map(id => getUsernameById(id)).join(", ")}
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
              
              {/* For bills that don't have any other payers than the current user */}
              {myBillsAsPayee.filter(bill => 
                bill.payers.length === 1 && bill.payers[0] === currentUser.id).length > 0 && (
                <SumikkoCard
                  key="self-bills"
                  title="Bills with only you as payer"
                  subtitle="These bills don't have any other payers"
                >
                  <ul className="space-y-4">
                    {myBillsAsPayee
                      .filter(bill => bill.payers.length === 1 && bill.payers[0] === currentUser.id)
                      .map((bill) => (
                        <li key={bill.id} className="sumikko-list-item">
                          {editingBill === bill.id ? (
                            // Edit form (same as above)
                            <div className="w-full space-y-3">
                              <Input
                                value={editFormData.title}
                                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                placeholder="Bill title"
                                className="w-full"
                              />
                              <div className="space-y-2">
                                <Label>Select Payee (Edit)</Label>
                                <select 
                                  className="w-full p-2 rounded-md border border-input"
                                  value={editFormData.payee}
                                  onChange={(e) => setEditFormData({
                                    ...editFormData,
                                    payee: e.target.value
                                  })}
                                >
                                  <option value="">Select a payee</option>
                                  <option value={currentUser.id}>{currentUser.username} (You)</option>
                                  {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.username}</option>
                                  ))}
                                </select>
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
                            // View mode (same as above but with modified styling)
                            <div className="flex items-center justify-between gap-4 w-full">
                              <div className="flex-grow">
                                <div className="font-medium flex items-baseline justify-between">
                                  <span className="text-base">{bill.title}</span>
                                  <span className="ml-2 text-lg font-semibold text-secondary-foreground">${bill.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between mt-2">
                                  <div className="text-muted-foreground">
                                    Date: {format(new Date(bill.due_date), "PPP")}
                                  </div>
                                </div>
                                <div className="text-muted-foreground">
                                  Created by: {getUsernameById(bill.created_by)}
                                </div>
                                <div className="text-sm font-medium mt-1 bg-secondary/10 p-1 rounded">
                                  <span className="font-semibold">Payer: </span>Only you
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
              )}
            </div>
          </div>
        )}

        {/* Other Bills (where others are the payee) */}
        {Object.keys(otherBillsByPayee).length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Money You Owe to Others
              <span className="ml-2 text-lg font-semibold text-primary">
                ${Object.values(otherBillsByPayee).reduce((total, bills) => {
                  return total + bills.reduce((subtotal, bill) => {
                    return subtotal + parseFloat(getPerPersonTotal(bill));
                  }, 0);
                }, 0).toFixed(2)} • {Object.values(otherBillsByPayee).reduce((total, bills) => total + bills.length, 0)} bill{Object.values(otherBillsByPayee).reduce((total, bills) => total + bills.length, 0) !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(otherBillsByPayee).map(([payee, payeeBills]) => {
                // Find the user name if payee is a user ID
                let payeeDisplayName = payee;
                if (payee !== "Unspecified") {
                  const foundUser = allUsers.find(user => user.id === payee);
                  if (foundUser) {
                    payeeDisplayName = foundUser.username;
                  }
                }
                
                // Calculate the per-person total for this group of bills
                const perPersonTotal = payeeBills.reduce((sum, bill) => {
                  return sum + parseFloat(getPerPersonTotal(bill));
                }, 0).toFixed(2);
                
                return (
                  <SumikkoCard
                    key={payee}
                    title={`Owed to ${payeeDisplayName}`}
                    subtitle={`$${perPersonTotal} your share • ${payeeBills.length} bill${payeeBills.length !== 1 ? 's' : ''}`}
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
                                <select 
                                  className="w-full p-2 rounded-md border border-input"
                                  value={editFormData.payee}
                                  onChange={(e) => setEditFormData({
                                    ...editFormData,
                                    payee: e.target.value
                                  })}
                                >
                                  <option value="">Select a payee</option>
                                  <option value={currentUser.id}>{currentUser.username} (You)</option>
                                  {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.username}</option>
                                  ))}
                                </select>
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
                                <div className="font-medium flex items-baseline justify-between">
                                  <span className="text-base">{bill.title}</span>
                                  <div className="text-base font-semibold mt-1 text-primary-foreground">
                                    Your share: <span className="text-lg">${getPerPersonTotal(bill)}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between mt-2">
                                  <div className="text-muted-foreground">
                                    Date: {format(new Date(bill.due_date), "PPP")}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="text-base">${bill.amount.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div className="text-muted-foreground">
                                  Created by: {getUsernameById(bill.created_by)}
                                </div>
                                <div className="text-sm font-medium mt-1 bg-primary/10 p-1 rounded">
                                  <span className="font-semibold">Payers: </span>
                                  {bill.payers.map(id => getUsernameById(id)).join(", ")}
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
        )}
      </div>
    </div>
  )
} 