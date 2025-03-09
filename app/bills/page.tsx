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
import { useGuest } from "@/lib/guest-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

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
  const { isGuest } = useGuest()

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        
        // For guest mode, load data without requiring auth
        if (isGuest) {
          // Get all users
          const { data: fetchedUsers } = await supabase
            .from("profiles")
            .select("*")

          if (fetchedUsers) {
            setAllUsers(fetchedUsers);
            setUsers(fetchedUsers);
          }

          // Get all bills
          const { data: allBills } = await supabase
            .from("bills")
            .select("*")
            .order("created_at", { ascending: false })

          if (allBills) {
            setBills(allBills)
          }

          setIsLoading(false)
          return
        }

        // For authenticated users, proceed with normal flow
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

  // Create a dummy currentUser for guests to avoid null reference errors
  const guestUser = isGuest ? {
    id: 'guest',
    username: 'Guest',
    created_at: new Date().toISOString()
  } : null;
  
  // Use the real currentUser or the guestUser in guest mode
  const activeUser = currentUser || guestUser;
  
  // Separate bills in a way that works for both guests and logged-in users
  const separateBills = () => {
    if (!activeUser) return { billsYouOwe: [], billsByPayee: {} };
    
    // Bills where you are a payer (money you owe)
    const billsYouOwe = isGuest 
      ? [] // Guest doesn't owe anything 
      : bills.filter(bill => 
          bill.payers.includes(activeUser.id) && 
          bill.payee !== activeUser.id
        );
        
    // Group bills by payee
    const billsByPayee = bills.reduce((acc, bill) => {
      if (!bill.payee) return acc;
      
      if (!acc[bill.payee]) {
        acc[bill.payee] = [];
      }
      acc[bill.payee].push(bill);
      return acc;
    }, {} as Record<string, Bill[]>);
    
    return { billsYouOwe, billsByPayee };
  };
  
  const { billsYouOwe, billsByPayee } = separateBills();
  
  // Bills where you are the payee (money owed to you)
  const myBillsAsPayee = isGuest ? [] : (billsByPayee[activeUser?.id || ''] || []);
  
  // Group my bills as payee by payers (only for logged-in users)
  const myBillsByPayer = isGuest ? {} : myBillsAsPayee.reduce((acc, bill) => {
    bill.payers.forEach(payerId => {
      if (payerId !== activeUser?.id) { // Don't group by yourself
        if (!acc[payerId]) {
          acc[payerId] = [];
        }
        acc[payerId].push(bill);
      }
    });
    return acc;
  }, {} as Record<string, Bill[]>);
  
  // Payees who owe you money
  const payeesToYou = isGuest ? [] : Object.keys(myBillsByPayer);
  
  // All other bills grouped by payee
  const otherBillsByPayee = { ...billsByPayee };
  if (!isGuest && activeUser?.id) {
    delete otherBillsByPayee[activeUser.id];
  }
  
  // Calculate per person total for a bill
  const getPerPersonTotal = (bill: Bill): string => {
    return getAmountPerPerson(bill);
  };
  
  const getAmountPerPerson = (bill: Bill): string => {
    if (bill.payers.length === 0) return "0.00";
    return (bill.amount / bill.payers.length).toFixed(2);
  };
  
  const getEstimatedAmountPerPerson = (amount: string, payersCount: number): string => {
    if (!amount || payersCount === 0) return "0.00";
    return (parseFloat(amount) / payersCount).toFixed(2);
  };
  
  const getUsernameById = (userId: string): string => {
    if (isGuest) {
      const user = allUsers.find(u => u.id === userId);
      return user ? user.username : "Unknown User";
    }
    
    if (activeUser && userId === activeUser.id) return `${activeUser.username} (You)`;
    const user = allUsers.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
  };
  
  const getYourShare = (bill: Bill): string => {
    if (isGuest) {
      return getAmountPerPerson(bill);
    }
    
    if (activeUser && bill.payers.includes(activeUser.id)) {
      return getAmountPerPerson(bill);
    }
    return "0.00";
  };
  
  // Calculate total for a group of bills
  const calculateGroupTotal = (billsGroup: Bill[]): string => {
    const total = billsGroup.reduce((sum, bill) => sum + bill.amount, 0);
    return total.toFixed(2);
  };
  
  // Calculate total amount you owe
  const calculateOwing = (): string => {
    if (isGuest) return "0.00";
    
    const total = billsYouOwe.reduce((sum, bill) => {
      // If you're one of multiple payers, divide by number of payers
      const yourShare = bill.amount / bill.payers.length;
      return sum + yourShare;
    }, 0);
    
    return total.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SumikkoHeader showBackButton />
        <div className="max-w-7xl mx-auto px-4">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser && !isGuest) {
    return (
      <div className="min-h-screen">
        <SumikkoHeader showBackButton />
        <div className="max-w-7xl mx-auto px-4">
          <p>You must be logged in to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        {isGuest && (
          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-center text-muted-foreground">
              You are in guest mode. You can view bills but cannot edit or add new ones.
            </p>
          </div>
        )}
        
        {!isGuest && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Bill</CardTitle>
              <CardDescription>Create a new bill to track household expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billName">Bill Name</Label>
                    <Input
                      id="billName"
                      value={newBillName}
                      onChange={(e) => setNewBillName(e.target.value)}
                      placeholder="Enter bill name"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="billAmount">Amount</Label>
                    <Input
                      id="billAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newBillAmount}
                      onChange={(e) => setNewBillAmount(e.target.value)}
                      placeholder="Enter amount"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billDate">Due Date</Label>
                    <Input
                      id="billDate"
                      type="date"
                      value={newBillDate}
                      onChange={(e) => setNewBillDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="billPayee">Payee</Label>
                    <Select
                      value={newBillPayee}
                      onValueChange={setNewBillPayee}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="billPayee">
                        <SelectValue placeholder="Select a payee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select a payee</SelectItem>
                        <SelectItem value={activeUser.id}>{activeUser.username} (You)</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Who pays for this bill?</Label>
                  <div className="grid grid-cols-2 gap-2 border rounded-md p-3 mt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`payer-${activeUser.id}`}
                        checked={selectedPayers.includes(activeUser.id)}
                        onCheckedChange={() => togglePayer(activeUser.id)}
                        className="sumikko-checkbox"
                      />
                      <Label 
                        htmlFor={`payer-${activeUser.id}`}
                        className="text-sm font-medium"
                      >
                        {activeUser.username} (You)
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
                  {newBillAmount && selectedPayers.length >= 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ${getEstimatedAmountPerPerson(newBillAmount, selectedPayers.length)} each
                      (split between {selectedPayers.length} payer{selectedPayers.length !== 1 ? 's' : ''})
                    </p>
                  )}
                </div>
                
                <Button
                  onClick={handleNewBill}
                  disabled={!newBillName || !newBillAmount || !newBillPayee || selectedPayers.length === 0 || isLoading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bill
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Money You Owe section */}
        <h2 className="text-2xl font-bold mb-4">
          Money You Owe to Others
          <span className="ml-2 text-lg font-semibold text-primary">
            ${calculateOwing()} • {billsYouOwe.length} bill{billsYouOwe.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {/* Other bill displays that show specific bills need to be updated too */}
        {Object.entries(otherBillsByPayee).map(([payeeId, payeeBills]) => {
          if (payeeBills.length === 0) return null;
          
          const payeeName = getUsernameById(payeeId);
          const groupTotal = calculateGroupTotal(payeeBills);
          
          return (
            <SumikkoCard
              key={payeeId}
              title={`Owed to ${payeeName} `}
              titleExtra={<span className="ml-1 text-base font-semibold text-primary">${groupTotal} • {payeeBills.length} bill{payeeBills.length !== 1 ? 's' : ''}</span>}
            >
              <ul className="space-y-4">
                {payeeBills.map(bill => (
                  <li key={bill.id}>
                    {editingBill === bill.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`edit-title-${bill.id}`}>Bill Name</Label>
                            <Input
                              id={`edit-title-${bill.id}`}
                              value={editFormData.title}
                              onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-amount-${bill.id}`}>Amount</Label>
                            <Input
                              id={`edit-amount-${bill.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editFormData.amount}
                              onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`edit-date-${bill.id}`}>Due Date</Label>
                            <Input
                              id={`edit-date-${bill.id}`}
                              type="date"
                              value={editFormData.due_date}
                              onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-payee-${bill.id}`}>Payee</Label>
                            <Select
                              value={editFormData.payee}
                              onValueChange={(value) => setEditFormData({ ...editFormData, payee: value })}
                            >
                              <SelectTrigger id={`edit-payee-${bill.id}`}>
                                <SelectValue placeholder="Select a payee" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Select a payee</SelectItem>
                                <SelectItem value={activeUser.id}>{activeUser.username} (You)</SelectItem>
                                {users.map(user => (
                                  <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => handleSaveEdit(bill.id, bill.payers)}
                            className="flex-1"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="flex-1"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-secondary/20 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">{bill.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              Created by: {getUsernameById(bill.created_by)}
                            </p>
                            <p className="text-sm mb-1">
                              <span className="text-muted-foreground">Due date:</span>{" "}
                              {format(new Date(bill.due_date), "PPP")}
                            </p>
                            <p className="text-sm mb-1">
                              <span className="text-muted-foreground">Payers:</span>{" "}
                              {bill.payers.map(id => getUsernameById(id)).join(", ")}
                            </p>
                            <p className="text-sm font-medium">
                              <span className="text-muted-foreground">Total:</span>{" "}
                              <span>${bill.amount.toFixed(2)}</span>
                            </p>
                            <p className="text-sm font-semibold text-primary mt-2">
                              <span>Your share:</span>{" "}
                              ${getYourShare(bill)}
                            </p>
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Per person:</span>{" "}
                              ${getAmountPerPerson(bill)}
                            </p>
                          </div>
                          
                          {!isGuest && bill.created_by === activeUser.id && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditBill(bill)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive-foreground"
                                onClick={() => handleDeleteBill(bill.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </SumikkoCard>
          );
        })}

        {/* Money Owed to You section */}
        {!isGuest && (
          <>
            <h2 className="text-2xl font-bold mb-4">
              Money Owed to You 
              <span className="ml-2 text-lg font-semibold text-primary">
                ${calculateGroupTotal(myBillsAsPayee)} • {myBillsAsPayee.length} bill{myBillsAsPayee.length !== 1 ? 's' : ''}
              </span>
            </h2>
            
            {/* People who owe you money */}
            {payeesToYou.map(payerId => {
              const payerBills = myBillsByPayer[payerId];
              
              if (payerBills.length === 0) return null;
              
              const payerName = getUsernameById(payerId);
              const groupTotal = calculateGroupTotal(payerBills);
              
              return (
                <SumikkoCard
                  key={payerId}
                  title={`Owed by ${payerName} `}
                  titleExtra={<span className="ml-1 text-base font-semibold text-primary">${groupTotal} • {payerBills.length} bill{payerBills.length !== 1 ? 's' : ''}</span>}
                >
                  <ul className="space-y-4">
                    {payerBills.map(bill => (
                      <li key={bill.id}>
                        {editingBill === bill.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`edit-title-${bill.id}`}>Bill Name</Label>
                                <Input
                                  id={`edit-title-${bill.id}`}
                                  value={editFormData.title}
                                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-amount-${bill.id}`}>Amount</Label>
                                <Input
                                  id={`edit-amount-${bill.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editFormData.amount}
                                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`edit-date-${bill.id}`}>Due Date</Label>
                                <Input
                                  id={`edit-date-${bill.id}`}
                                  type="date"
                                  value={editFormData.due_date}
                                  onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-payee-${bill.id}`}>Payee</Label>
                                <Select
                                  value={editFormData.payee}
                                  onValueChange={(value) => setEditFormData({ ...editFormData, payee: value })}
                                >
                                  <SelectTrigger id={`edit-payee-${bill.id}`}>
                                    <SelectValue placeholder="Select a payee" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">Select a payee</SelectItem>
                                    <SelectItem value={activeUser.id}>{activeUser.username} (You)</SelectItem>
                                    {users.map(user => (
                                      <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button 
                                onClick={() => handleSaveEdit(bill.id, bill.payers)}
                                className="flex-1"
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="flex-1"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-secondary/20 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-semibold mb-1">{bill.title}</h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Created by: {getUsernameById(bill.created_by)}
                                </p>
                                <p className="text-sm mb-1">
                                  <span className="text-muted-foreground">Due date:</span>{" "}
                                  {format(new Date(bill.due_date), "PPP")}
                                </p>
                                <p className="text-sm mb-1">
                                  <span className="text-muted-foreground">Payers:</span>{" "}
                                  {bill.payers.map(id => getUsernameById(id)).join(", ")}
                                </p>
                                <p className="text-sm font-medium">
                                  <span className="text-muted-foreground">Total:</span>{" "}
                                  <span>${bill.amount.toFixed(2)}</span>
                                </p>
                                <p className="text-sm font-semibold text-primary mt-2">
                                  <span>Your share:</span>{" "}
                                  ${getYourShare(bill)}
                                </p>
                                <p className="text-sm mt-1">
                                  <span className="text-muted-foreground">Per person:</span>{" "}
                                  ${getAmountPerPerson(bill)}
                                </p>
                              </div>
                              
                              {!isGuest && bill.created_by === activeUser.id && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditBill(bill)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive-foreground"
                                    onClick={() => handleDeleteBill(bill.id)}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
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
              bill.payers.length === 1 && bill.payers[0] === activeUser.id).length > 0 && (
              <SumikkoCard
                key="self-bills"
                title="Bills with only you as payer "
                titleExtra={<span className="ml-1 text-base font-semibold text-primary">${calculateGroupTotal(myBillsAsPayee.filter(bill => bill.payers.length === 1 && bill.payers[0] === activeUser.id))} • {myBillsAsPayee.filter(bill => bill.payers.length === 1 && bill.payers[0] === activeUser.id).length} bill{myBillsAsPayee.filter(bill => bill.payers.length === 1 && bill.payers[0] === activeUser.id).length !== 1 ? 's' : ''}</span>}
              >
                <ul className="space-y-4">
                  {myBillsAsPayee
                    .filter(bill => bill.payers.length === 1 && bill.payers[0] === activeUser.id)
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
                                <option value={activeUser.id}>{activeUser.username} (You)</option>
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
                                <div>
                                  <span className="text-muted-foreground">Total: </span>
                                  <span className="text-lg font-semibold text-secondary-foreground">${bill.amount.toFixed(2)}</span>
                                </div>
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
                            {bill.created_by === activeUser.id && (
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
          </>
        )}
      </div>
    </div>
  )
} 