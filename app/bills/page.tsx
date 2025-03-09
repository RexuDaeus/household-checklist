"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SumikkoHeader } from "@/components/sumikko-header"
import { SumikkoCard } from "@/components/sumikko-card"
import { supabase } from "@/lib/supabase"
import type { Bill, Profile } from "@/lib/supabase"

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [newBillName, setNewBillName] = useState("")
  const [newBillAmount, setNewBillAmount] = useState("")
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
          const { data: allUsers } = await supabase
            .from("profiles")
            .select("*")

          if (allUsers) {
            // Filter out the current user for the UI list
            setUsers(allUsers.filter(user => user.id !== session.user.id))
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
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Set up real-time subscription for bills
    const billsSubscription = supabase
      .channel("bills")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills"
        },
        async (payload) => {
          // Reload bills when there's a change
          const { data: userBills } = await supabase
            .from("bills")
            .select("*")
            .or(`created_by.eq.${currentUser?.id},payers.cs.{${currentUser?.id}}`)
            .order("created_at", { ascending: false })

          if (userBills) {
            setBills(userBills)
          }
        }
      )
      .subscribe()

    return () => {
      billsSubscription.unsubscribe()
    }
  }, [router])

  const handleNewBill = async () => {
    if (!newBillName || !newBillAmount || selectedPayers.length === 0 || !currentUser) return

    try {
      const { data: bill, error } = await supabase
        .from("bills")
        .insert([{
          title: newBillName,
          amount: parseFloat(newBillAmount),
          payers: selectedPayers,
          created_by: currentUser.id,
          due_date: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      setNewBillName("")
      setNewBillAmount("")
      setSelectedPayers([])
    } catch (error) {
      console.error("Error adding bill:", error)
    }
  }

  const handleDeleteBill = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bills")
        .delete()
        .eq("id", id)

      if (error) throw error
    } catch (error) {
      console.error("Error deleting bill:", error)
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

  // Group bills by creator
  const billsByCreator = bills.reduce((acc, bill) => {
    if (!acc[bill.created_by]) {
      acc[bill.created_by] = []
    }
    acc[bill.created_by].push(bill)
    return acc
  }, {} as Record<string, Bill[]>)

  // Calculate totals for each creator
  const creatorTotals = Object.entries(billsByCreator).reduce((acc, [creator, bills]) => {
    acc[creator] = bills.reduce((sum, bill) => {
      if (bill.payers.includes(currentUser.id) && bill.created_by !== currentUser.id) {
        return sum + (bill.amount / bill.payers.length)
      }
      return sum + bill.amount
    }, 0)
    return acc
  }, {} as Record<string, number>)

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
              disabled={!newBillName || !newBillAmount || selectedPayers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </SumikkoCard>

        {Object.entries(billsByCreator).map(([creatorId, creatorBills]) => {
          const creator = users.find(u => u.id === creatorId) || currentUser
          return (
            <SumikkoCard
              key={creatorId}
              title={creatorId === currentUser.id ? "Bills You Created" : `Bills From ${creator.username}`}
              subtitle={creatorId === currentUser.id 
                ? `Total amount: $${creatorTotals[creatorId].toFixed(2)}`
                : `Your share: $${creatorTotals[creatorId].toFixed(2)}`
              }
            >
              <ul className="space-y-4">
                {creatorBills.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-4 sumikko-list-item">
                    <div>
                      <div className="font-medium">{bill.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {creatorId === currentUser.id ? (
                          <>Total: ${bill.amount.toFixed(2)} • ${getAmountPerPerson(bill.amount, bill.payers.length)} each</>
                        ) : (
                          <>Your share: ${getAmountPerPerson(bill.amount, bill.payers.length)}</>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {creatorId === currentUser.id ? (
                          <>To be paid by: {bill.payers.map(id => 
                            users.find(u => u.id === id)?.username
                          ).join(", ")}</>
                        ) : (
                          <>Other payers: {bill.payers.filter(id => id !== currentUser.id)
                            .map(id => users.find(u => u.id === id)?.username).join(", ")}</>
                        )}
                      </div>
                    </div>
                    {creatorId === currentUser.id && (
                      <Button
                        className={buttonVariants({ variant: "destructive", size: "sm", className: "rounded-full" })}
                        onClick={() => handleDeleteBill(bill.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </SumikkoCard>
          )
        })}
      </div>
    </div>
  )
} 