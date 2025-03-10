"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import React from "react"
import { ProfileAvatar } from "@/components/profile-avatar"
import { UserDisplay } from "@/components/user-display"

// Use a simpler and more reliable approach for the masonry layout using CSS grid
function arrangeGridItems(gridId: string) {
  if (typeof window === 'undefined') return;
  
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  // On mobile, use a single column
  if (window.innerWidth < 768) {
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '1.5rem';
    return;
  }
  
  // Change to relative positioning container
  grid.style.display = 'block';
  grid.style.position = 'relative';
  grid.style.width = '100%';
  grid.style.height = 'auto';
  
  // Get all the bill cards
  const cards = Array.from(grid.querySelectorAll('.bill-card')) as HTMLElement[];
  if (cards.length <= 1) {
    // If only one card, just make it full width
    if (cards.length === 1) {
      const card = cards[0];
      card.style.position = 'relative';
      card.style.width = '100%';
      card.style.marginBottom = '1.5rem';
    }
    return;
  }
  
  // First pass: set all cards to absolute and get measurements
  cards.forEach(card => {
    // Reset styles
    card.style.position = '';
    card.style.top = '';
    card.style.left = '';
    card.style.width = '';
    card.style.marginTop = '';
    card.style.marginBottom = '';
    card.style.display = 'block';
  });
  
  // Force reflow to ensure correct measurements
  grid.getBoundingClientRect();
  
  // Calculate column width
  const containerWidth = grid.offsetWidth;
  const columnWidth = (containerWidth - 24) / 2; // 24px is the gap
  
  // Prep for layout
  let leftColumnHeight = 0;
  let rightColumnHeight = 0;
  
  // Second pass: position cards
  cards.forEach((card, index) => {
    // Get natural height
    const cardHeight = card.offsetHeight;
    
    // Set width
    card.style.position = 'absolute';
    card.style.width = `${columnWidth}px`;
    
    // Decide which column to place in
    if (leftColumnHeight <= rightColumnHeight) {
      // Place in left column
      card.style.left = '0';
      card.style.top = `${leftColumnHeight}px`;
      leftColumnHeight += cardHeight + 24; // Add card height + gap
    } else {
      // Place in right column
      card.style.left = `${columnWidth + 24}px`; // Column width + gap
      card.style.top = `${rightColumnHeight}px`;
      rightColumnHeight += cardHeight + 24; // Add card height + gap
    }
  });
  
  // Set container height
  grid.style.height = `${Math.max(leftColumnHeight, rightColumnHeight)}px`;
}

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
    payers: string[];
    notes: string;
  }>({
    title: "",
    amount: "",
    payee: "",
    due_date: "",
    payers: [],
    notes: ""
  })
  const router = useRouter()
  const [archivedBills, setArchivedBills] = useState<Bill[]>([])
  const [archivedBillsCount, setArchivedBillsCount] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [newBillNotes, setNewBillNotes] = useState("")

  // Use useRef to track when the component has mounted
  const hasMounted = useRef(false);

  // Modify the useCallback to use the external function
  const applyMasonryLayout = useCallback(() => {
    // Only run this on the client, not during SSR
    if (typeof window !== 'undefined') {
      arrangeGridItems('bills-masonry-grid');
      arrangeGridItems('other-bills-masonry-grid');
    }
  }, []);

  // Update useEffect to be more reliable with the new layout approach
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) return;
    
    // Apply layout after content has likely loaded
    let layoutTimer: NodeJS.Timeout;
    
    const applyLayout = () => {
      // Clear any existing timer
      if (layoutTimer) clearTimeout(layoutTimer);
      
      // Initial immediate layout
      applyMasonryLayout();
      
      // Try again after a delay to account for image loading, etc.
      layoutTimer = setTimeout(applyMasonryLayout, 500);
    };
    
    // Apply layout on initial load
    applyLayout();
    
    // Apply layout on window resize
    const handleResize = () => {
      applyLayout();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      if (layoutTimer) clearTimeout(layoutTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isLoading, applyMasonryLayout]);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Load all users
        const { data: usersData } = await supabase
          .from("profiles")
          .select("*")
          .order("username");
        
        if (usersData) {
          setAllUsers(usersData);
          
          // Find current user
          const currentUserData = usersData.find(user => user.id === session.user.id);
          setCurrentUser(currentUserData || null);
          
          // Set user list excluding current user for payer selection
          setUsers(usersData.filter(user => user.id !== session.user.id));
        }

        // Load bills
        const { data: billsData, error } = await supabase
          .from("bills")
          .select("*")
          .or(`created_by.eq.${session.user.id},payers.cs.{${session.user.id}},payee.eq.${session.user.id}`)
          .order("created_at", { ascending: false });
        
        if (error) {
          console.error("Error loading bills:", error);
          return;
        }
        
        if (billsData) {
          setBills(billsData);
        }
        
        // Load archived bills count
        const { count } = await supabase
          .from("archived_bills")
          .select("*", { count: "exact", head: true })
          .eq("payer_id", session.user.id);
        
        setArchivedBillsCount(count || 0);
      } catch (error) {
        console.error("Error in loadData:", error);
      } finally {
        setIsLoading(false);
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
        created_at: new Date().toISOString(),
        notes: newBillNotes || null // Add notes back
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
      setNewBillNotes("");
    } catch (error) {
      console.error("Error adding bill:", error);
      alert("Failed to add bill. Please check the console for details.");
    }
  }

  const handleDeleteBill = async (id: string, payerId?: string) => {
    // Find the bill first
    const billToDelete = bills.find(bill => bill.id === id);
    
    // Only allow the creator to delete the bill
    if (!billToDelete || billToDelete.created_by !== currentUser?.id) return;
  
    // Confirm deletion with the user
    if (!window.confirm(`Are you sure you want to remove "${billToDelete.title}" for ${getUsernameById(payerId || '')}`)) {
      return; // User canceled the deletion
    }

    try {
      // If payerId is specified, we're just removing that specific payer
      if (payerId) {
        // Get updated payers array without the specified payer
        const updatedPayers = billToDelete.payers.filter(p => p !== payerId);
        
        // Update UI optimistically
        setBills(prevBills => prevBills.map(bill => 
          bill.id === id ? { ...bill, payers: updatedPayers } : bill
        ));
        
        console.log(`Optimistically removed payer ${payerId} from bill ${id}`);
        
        if (updatedPayers.length === 0) {
          // If no payers left, delete the bill
          const { error: deleteError } = await supabase
            .from("bills")
            .delete()
            .eq("id", id);

          if (deleteError) {
            console.error("Error deleting bill:", deleteError);
            alert("Failed to delete bill on the server.");
            
            // Revert UI update on error
            const { data } = await supabase
              .from("bills")
              .select("*")
              .eq("id", id);
              
            if (data && data.length > 0) {
              setBills(prevBills => [...prevBills, data[0]]);
            }
            return;
          }
        } else {
          // Update the original bill's payers list
          const { error: updateError } = await supabase
            .from("bills")
            .update({ payers: updatedPayers })
            .eq("id", id);

          if (updateError) {
            console.error("Error updating bill:", updateError);
            alert("Failed to update bill on the server.");
            
            // Revert UI update on error
            const { data } = await supabase
              .from("bills")
              .select("*")
              .eq("id", id);
              
            if (data && data.length > 0) {
              setBills(prevBills => prevBills.map(bill => 
                bill.id === id ? data[0] : bill
              ));
            }
            return;
          }
        }
      } else {
        // No payerId specified, delete the entire bill
        if (!window.confirm("Are you sure you want to delete this bill for ALL users?")) {
          return; // User canceled the deletion
        }
        
        // Update UI optimistically
        setBills(prevBills => prevBills.filter(b => b.id !== id));
        
        console.log(`Optimistically deleted bill ${id}`);
        
        // Delete from database
        const { error } = await supabase
          .from("bills")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("Error deleting bill:", error);
          alert("Failed to delete bill on the server. The bill may reappear if you reload.");
          
          // Revert the UI update if there was an error
          const { data } = await supabase
            .from("bills")
            .select("*")
            .eq("id", id);
            
          if (data && data.length > 0) {
            setBills(prevBills => [...prevBills, data[0]]);
          }
        } else {
          console.log("Successfully deleted bill");
        }
      }
    } catch (error) {
      console.error("Error deleting bill:", error);
      alert("An unexpected error occurred while deleting the bill.");
    }
  };

  const handleEditBill = (bill: Bill) => {
    // Only allow the creator to edit the bill
    if (bill.created_by !== currentUser?.id) return;
    
    setEditingBill(bill.id);
    setEditFormData({
      title: bill.title,
      amount: bill.amount.toString(),
      payee: bill.payee || "",
      due_date: format(new Date(bill.due_date), "yyyy-MM-dd"),
      payers: [...bill.payers],
      notes: bill.notes || ""
    });
  }

  const handleCancelEdit = () => {
    setEditingBill(null);
  }

  const handleSaveEdit = async (billId: string) => {
    try {
      const { title, amount, payee, due_date, payers, notes } = editFormData;
      
      if (!title || !amount || payers.length === 0) {
        alert("Please fill in all required fields and select at least one payer.");
        return;
      }
      
      const updatedBill = {
        title,
        amount: parseFloat(amount),
        payee,
        due_date: new Date(due_date).toISOString(),
        payers,
        notes: notes || null // Add notes back
      };
      
      // Update UI optimistically
      setBills(prevBills => 
        prevBills.map(bill => 
          bill.id === billId 
            ? { ...bill, ...updatedBill } 
            : bill
        )
      );
      
      // Update in database
      const { error } = await supabase
        .from("bills")
        .update(updatedBill)
        .eq("id", billId);
      
      if (error) {
        console.error("Error updating bill:", error);
        alert("Failed to update the bill on the server.");
        
        // Revert optimistic update
        const { data } = await supabase
          .from("bills")
          .select("*")
          .eq("id", billId);
          
        if (data && data.length > 0) {
          setBills(prevBills => 
            prevBills.map(bill => 
              bill.id === billId ? data[0] : bill
            )
          );
        }
      } else {
        console.log("Successfully updated bill");
      }
      
      // Reset edit state
      setEditingBill(null);
    } catch (error) {
      console.error("Error saving edit:", error);
      alert("An error occurred while saving changes.");
    }
  };

  // Update the handleMarkAsPaid function to handle individual payer archiving
  const handleMarkAsPaid = async (billId: string, payerId: string) => {
    // Find the bill
    const bill = bills.find(bill => bill.id === billId);
    
    // Only allow the creator to mark bills as paid
    if (!bill || bill.created_by !== currentUser?.id) return;
    
    try {
      console.log("Archiving bill:", bill, "payer:", payerId);
      
      // Create a copy of the bill with only this payer
      const archivedBill = { 
        ...bill, 
        payers: [payerId], // Only include the specific payer being archived
        archived_at: new Date().toISOString()
      };
      
      // Add to archived_bills table
      const { data: archivedData, error: archiveError } = await supabase
        .from("archived_bills")
        .insert([{
          original_bill_id: billId,
          payer_id: payerId,
          bill_data: archivedBill,
          archived_at: new Date().toISOString()
        }])
        .select();

      if (archiveError) {
        console.error("Error archiving bill:", archiveError);
        alert("Failed to archive bill: " + archiveError.message);
        return;
      }
      
      console.log("Successfully archived bill, archived record:", archivedData);

      // Remove this payer from the original bill
      const updatedPayers = bill.payers.filter(p => p !== payerId);
      
      if (updatedPayers.length === 0) {
        // If no payers left, delete the bill
        const { error: deleteError } = await supabase
          .from("bills")
          .delete()
          .eq("id", billId);

        if (deleteError) {
          console.error("Error deleting bill:", deleteError);
          alert("Failed to delete bill on the server.");
          return;
        }

        // Update local state
        setBills(prevBills => prevBills.filter(b => b.id !== billId));
      } else {
        // Update the original bill's payers list
        const { error: updateError } = await supabase
          .from("bills")
          .update({ payers: updatedPayers })
          .eq("id", billId);

        if (updateError) {
          console.error("Error updating original bill:", updateError);
          alert("Failed to update original bill on the server.");
          return;
        }

        // Update local state
        setBills(prevBills => prevBills.map(b => 
          b.id === billId ? { ...b, payers: updatedPayers } : b
        ));
      }
    } catch (error) {
      console.error("Error marking bill as paid:", error);
      alert("An unexpected error occurred while archiving the bill.");
    }
  };

  // Add this function to handle marking all bills as paid for a specific payer
  const handleMarkAllAsPaid = async (payerId: string) => {
    // Get all bills where this payer is included and current user is creator
    const billsToArchive = bills.filter(bill => 
      bill.created_by === currentUser?.id && 
      bill.payers.includes(payerId)
    );
    
    if (billsToArchive.length === 0) return;
    
    // Confirm with the user
    if (!window.confirm(`Mark all ${billsToArchive.length} bills as paid for ${getUsernameById(payerId)}?`)) {
      return;
    }
    
    // Process each bill
    for (const bill of billsToArchive) {
      await handleMarkAsPaid(bill.id, payerId);
    }
  };

  const getAmountPerPerson = (amount: number, payersCount: number) => {
    if (payersCount === 0) return "0.00"
    return (amount / payersCount).toFixed(2)
  }

  const getUserById = (userId: string): Profile => {
    if (userId === currentUser?.id) {
      return { ...currentUser, is_current_user: true };
    }
    const user = allUsers.find(u => u.id === userId);
    return user || { id: "unknown", username: "Unknown User", created_at: "", is_current_user: false };
  }

  const getUserDisplayElement = (userId: string): React.ReactNode => {
    const user = getUserById(userId);
    return <UserDisplay user={user} />;
  }
  
  const getUsernameById = (userId: string): string => {
    if (userId === currentUser?.id) return `${currentUser.username} (You)`;
    const user = allUsers.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
  }

  // First, we need to ensure that the calculateGroupTotal function properly handles per-person amounts
  const calculateGroupTotal = (billsGroup: Bill[]): string => {
    const total = billsGroup.reduce((sum, bill) => {
      const perPersonAmount = parseFloat(getAmountPerPerson(bill.amount, bill.payers.length));
      return sum + perPersonAmount;
    }, 0);
    return total.toFixed(2);
  };

  // Add a function to group bills by date
  const groupBillsByDate = (bills: Bill[]) => {
    const grouped: Record<string, Bill[]> = {};
    
    bills.forEach(bill => {
      // Format the date as "DD MMM YYYY" (e.g., "15 Feb 2025")
      const dateKey = format(new Date(bill.due_date), "dd MMM yyyy");
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(bill);
    });
    
    // Sort the dates with newest first
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Create a new object with sorted keys
    const sortedGrouped: Record<string, Bill[]> = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });
    
    return sortedGrouped;
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

  // Then we need a function to calculate the total across all payer groups
  const calculateTotalAcrossGroups = (payerGroups: Record<string, Bill[]>): string => {
    let total = 0;
    
    // Sum up the group total for each payer
    Object.values(payerGroups).forEach(payerBills => {
      total += parseFloat(calculateGroupTotal(payerBills));
    });
    
    // We no longer add bills where you're the only payer to the total
    
    return total.toFixed(2);
  };

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
  
  // Group my bills as payee by payers, excluding self-bills
  const myBillsByPayer = myBillsAsPayee.reduce((acc, bill) => {
    bill.payers.forEach(payerId => {
      if (payerId !== currentUser.id) { // Don't include yourself
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

  const togglePayer = (payerId: string) => {
    setSelectedPayers(prev => 
      prev.includes(payerId)
        ? prev.filter(id => id !== payerId)
        : [...prev, payerId]
    )
  }

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4 py-2">
        <SumikkoHeader showBackButton />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline"
            onClick={() => router.push("/bills/archive")}
            className="flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-archive">
              <rect width="20" height="5" x="2" y="3" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
            View Archived Bills
          </Button>
        </div>

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
            <div className="space-y-2">
              <Label htmlFor="billNotes">Notes (Optional)</Label>
              <textarea
                id="billNotes"
                className="sumikko-input w-full p-2 rounded-md border border-input resize-vertical"
                value={newBillNotes}
                onChange={(e) => setNewBillNotes(e.target.value)}
                placeholder="Add any additional notes about this bill"
                rows={3}
              />
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

        {/* My Bills (where I'm the payee) */}
        {myBillsAsPayee.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Money Owed to You 
              <span className="ml-2 text-lg font-semibold text-primary">
                ${calculateTotalAcrossGroups(myBillsByPayer)}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-auto" id="bills-masonry-grid">
              {Object.entries(myBillsByPayer).map(([payerId, payerBills]) => {
                const payerName = getUsernameById(payerId);
                const groupTotal = calculateGroupTotal(payerBills);
                const billsByDate = groupBillsByDate(payerBills);
                
                return (
                  <div key={payerId} className="h-fit bill-card">
                    <SumikkoCard
                      title={
                        <div className="flex justify-between w-full items-center">
                          <div>Owed by {getUserDisplayElement(payerId)}</div>
                          {currentUser?.id === bills.find(bill => bill.payers.includes(payerId))?.created_by && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleMarkAllAsPaid(payerId)}
                              className="ml-2 whitespace-nowrap"
                            >
                              Mark All Paid
                            </Button>
                          )}
                        </div>
                      }
                      titleExtra={<span className="ml-1 text-base font-semibold text-primary">${groupTotal} • {payerBills.length} bill{payerBills.length !== 1 ? 's' : ''}</span>}
                    >
                      <div className="space-y-6">
                        {Object.entries(billsByDate).map(([dateKey, dateBills]) => (
                          <div key={dateKey}>
                            <h3 className="font-medium text-sm text-primary mb-2">{dateKey}</h3>
                            <ul className="space-y-4">
                              {dateBills.map((bill) => (
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
                                      <div className="space-y-2">
                                        <Label>Notes (Optional)</Label>
                                        <textarea
                                          value={editFormData.notes || ""}
                                          onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                          placeholder="Additional notes about this bill"
                                          className="w-full p-2 rounded-md border border-input resize-vertical"
                                          rows={3}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Select Payers (Edit)</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`edit-payer-${currentUser.id}`}
                                              checked={editFormData.payers.includes(currentUser.id)}
                                              onCheckedChange={() => {
                                                const isCurrentlySelected = editFormData.payers.includes(currentUser.id);
                                                setEditFormData({
                                                  ...editFormData,
                                                  payers: isCurrentlySelected 
                                                    ? editFormData.payers.filter(id => id !== currentUser.id)
                                                    : [...editFormData.payers, currentUser.id]
                                                });
                                              }}
                                            />
                                            <Label 
                                              htmlFor={`edit-payer-${currentUser.id}`}
                                              className="text-sm font-medium"
                                            >
                                              {currentUser.username} (You)
                                            </Label>
                                          </div>
                                          {users.map(user => (
                                            <div key={user.id} className="flex items-center space-x-2">
                                              <Checkbox
                                                id={`edit-payer-${user.id}`}
                                                checked={editFormData.payers.includes(user.id)}
                                                onCheckedChange={() => {
                                                  const isCurrentlySelected = editFormData.payers.includes(user.id);
                                                  setEditFormData({
                                                    ...editFormData,
                                                    payers: isCurrentlySelected 
                                                      ? editFormData.payers.filter(id => id !== user.id)
                                                      : [...editFormData.payers, user.id]
                                                  });
                                                }}
                                              />
                                              <Label 
                                                htmlFor={`edit-payer-${user.id}`}
                                                className="text-sm font-medium"
                                              >
                                                {user.username}
                                              </Label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
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
                                          onClick={() => handleSaveEdit(bill.id)}
                                        >
                                          <Save className="h-4 w-4 mr-1" /> Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    // View mode - Fix the layout for consistent buttons
                                    <div className="flex flex-col w-full">
                                      <div className="flex-grow">
                                        <div className="font-medium flex items-baseline justify-between">
                                          <span className="text-base">{bill.title}</span>
                                          <div>
                                            <span className="text-muted-foreground">Per person: </span>
                                            <span className="text-lg font-semibold text-secondary-foreground">${getAmountPerPerson(bill.amount, bill.payers.length)}</span>
                                          </div>
                                        </div>
                                        <div className="flex justify-between mt-2">
                                          <div className="text-muted-foreground">
                                            Created by: {getUserDisplayElement(bill.created_by)}
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Total: </span>
                                            <span className="text-base">${bill.amount.toFixed(2)}</span>
                                          </div>
                                        </div>
                                        {bill.notes && (
                                          <div className="text-sm mt-1 text-muted-foreground bg-secondary/10 p-2 rounded">
                                            <span className="font-semibold">Notes: </span>
                                            {bill.notes}
                                          </div>
                                        )}
                                        <div className="text-sm font-medium mt-1 bg-secondary/10 p-1 rounded">
                                          <span className="font-semibold">Payers: </span>
                                          {bill.payers.map((id, index) => (
                                            <React.Fragment key={id}>
                                              {index > 0 && ", "}
                                              {getUserDisplayElement(id)}
                                            </React.Fragment>
                                          ))}
                                        </div>
                                      </div>
                                      {bill.created_by === currentUser.id && (
                                        <div className="flex flex-row justify-end mt-3 space-x-2">
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleMarkAsPaid(bill.id, payerId)}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                          >
                                            Mark Paid
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditBill(bill)}
                                            className="rounded-full"
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDeleteBill(bill.id, payerId)}
                                            className="rounded-full"
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
                          </div>
                        ))}
                      </div>
                    </SumikkoCard>
                  </div>
                );
              })}
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
                }, 0).toFixed(2)}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-auto" id="other-bills-masonry-grid">
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
                
                // Group bills by date like in the "Money Owed to You" section
                const billsByDate = groupBillsByDate(payeeBills);
                
                return (
                  <div key={payee} className="h-fit bill-card">
                    <SumikkoCard
                      title={
                        <div className="flex justify-between w-full items-center">
                          <div>Owed to {getUserDisplayElement(payee)}</div>
                        </div>
                      }
                      titleExtra={<span className="ml-1 text-base font-semibold text-primary">${perPersonTotal} • {payeeBills.length} bill{payeeBills.length !== 1 ? 's' : ''}</span>}
                    >
                      <ul className="space-y-4">
                        {Object.entries(billsByDate).map(([dateKey, dateBills]) => (
                          <div key={dateKey}>
                            <h3 className="font-medium text-sm text-primary mb-2">{dateKey}</h3>
                            {dateBills.map((bill) => (
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
                                    <div className="space-y-2">
                                      <Label>Notes (Optional)</Label>
                                      <textarea
                                        value={editFormData.notes || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                        placeholder="Additional notes about this bill"
                                        className="w-full p-2 rounded-md border border-input resize-vertical"
                                        rows={3}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Select Payers (Edit)</Label>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center space-x-2">
                                          <Checkbox
                                            id={`edit-payer-${currentUser.id}`}
                                            checked={editFormData.payers.includes(currentUser.id)}
                                            onCheckedChange={() => {
                                              const isCurrentlySelected = editFormData.payers.includes(currentUser.id);
                                              setEditFormData({
                                                ...editFormData,
                                                payers: isCurrentlySelected 
                                                  ? editFormData.payers.filter(id => id !== currentUser.id)
                                                  : [...editFormData.payers, currentUser.id]
                                              });
                                            }}
                                          />
                                          <Label 
                                            htmlFor={`edit-payer-${currentUser.id}`}
                                            className="text-sm font-medium"
                                          >
                                            {currentUser.username} (You)
                                          </Label>
                                        </div>
                                        {users.map(user => (
                                          <div key={user.id} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`edit-payer-${user.id}`}
                                              checked={editFormData.payers.includes(user.id)}
                                              onCheckedChange={() => {
                                                const isCurrentlySelected = editFormData.payers.includes(user.id);
                                                setEditFormData({
                                                  ...editFormData,
                                                  payers: isCurrentlySelected 
                                                    ? editFormData.payers.filter(id => id !== user.id)
                                                    : [...editFormData.payers, user.id]
                                                });
                                              }}
                                            />
                                            <Label 
                                              htmlFor={`edit-payer-${user.id}`}
                                              className="text-sm font-medium"
                                            >
                                              {user.username}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
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
                                        onClick={() => handleSaveEdit(bill.id)}
                                      >
                                        <Save className="h-4 w-4 mr-1" /> Save
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  // View mode - Fix the layout for consistent buttons
                                  <div className="flex flex-col w-full">
                                    <div className="flex-grow">
                                      <div className="font-medium flex items-baseline justify-between">
                                        <span className="text-base">{bill.title}</span>
                                        <div>
                                          <span className="text-muted-foreground">Per person: </span>
                                          <span className="text-lg font-semibold text-secondary-foreground">${getAmountPerPerson(bill.amount, bill.payers.length)}</span>
                                        </div>
                                      </div>
                                      <div className="flex justify-between mt-2">
                                        <div className="text-muted-foreground">
                                          Created by: {getUserDisplayElement(bill.created_by)}
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Total: </span>
                                          <span className="text-base">${bill.amount.toFixed(2)}</span>
                                        </div>
                                      </div>
                                      {bill.notes && (
                                        <div className="text-sm mt-1 text-muted-foreground bg-secondary/10 p-2 rounded">
                                          <span className="font-semibold">Notes: </span>
                                          {bill.notes}
                                        </div>
                                      )}
                                      <div className="text-sm font-medium mt-1 bg-secondary/10 p-1 rounded">
                                        <span className="font-semibold">Payers: </span>
                                        {bill.payers.map((id, index) => (
                                          <React.Fragment key={id}>
                                            {index > 0 && ", "}
                                            {getUserDisplayElement(id)}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>
                                    {bill.created_by === currentUser.id && (
                                      <div className="flex flex-row justify-end mt-3 space-x-2">
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleMarkAsPaid(bill.id, bill.payers[0])}
                                          className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                          Mark Paid
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleEditBill(bill)}
                                          className="rounded-full"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleDeleteBill(bill.id, bill.payers[0])}
                                          className="rounded-full"
                                        >
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </div>
                        ))}
                      </ul>
                    </SumikkoCard>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 