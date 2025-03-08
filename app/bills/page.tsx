"use client"

import { useState, useEffect, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SumikkoHeader } from "@/components/sumikko-header"
import { SumikkoCard } from "@/components/sumikko-card"

interface User {
  username: string;
}

interface Bill {
  id: string;
  name: string;
  amount: number;
  payers: string[];
  createdBy: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [newBillName, setNewBillName] = useState("")
  const [newBillAmount, setNewBillAmount] = useState("")
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Get username from cookie
    const cookies = document.cookie.split(";")
    const userCookie = cookies.find((cookie) => cookie.trim().startsWith("user="))

    if (userCookie) {
      setUsername(userCookie.split("=")[1])
    } else {
      router.push("/login")
      return
    }

    // Load bills from localStorage
    const savedBills = localStorage.getItem("bills")
    if (savedBills) {
      setBills(JSON.parse(savedBills))
    }

    // Load users from localStorage
    const usersJson = localStorage.getItem("users")
    if (usersJson) {
      const parsedUsers = JSON.parse(usersJson)
      // Filter out the current user from the payers list
      const otherUsers = parsedUsers.filter((user: User) => user.username !== username)
      setUsers(otherUsers)
    }
  }, [router, username])

  useEffect(() => {
    // Save bills to localStorage whenever they change
    if (bills.length > 0) {
      localStorage.setItem("bills", JSON.stringify(bills))
    }
  }, [bills])

  const handleBillNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewBillName(e.target.value)
  }

  const handleBillAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewBillAmount(e.target.value)
  }

  const addBill = () => {
    if (!newBillName || !newBillAmount || selectedPayers.length === 0) return

    const newBill: Bill = {
      id: Date.now().toString(),
      name: newBillName,
      amount: parseFloat(newBillAmount),
      payers: selectedPayers,
      createdBy: username
    }

    setBills([...bills, newBill])
    setNewBillName("")
    setNewBillAmount("")
    setSelectedPayers([])
  }

  const deleteBill = (id: string) => {
    setBills(bills.filter((bill) => bill.id !== id))
  }

  const togglePayer = (payerUsername: string) => {
    setSelectedPayers(prev => 
      prev.includes(payerUsername)
        ? prev.filter(username => username !== payerUsername)
        : [...prev, payerUsername]
    )
  }

  // Calculate amount per person for a bill
  const getAmountPerPerson = (amount: number, payersCount: number) => {
    if (payersCount === 0) return "0.00"
    return (amount / payersCount).toFixed(2)
  }

  // Group bills by creator, but only show bills where the user is a payer or creator
  const billsByCreator = bills
    .filter(bill => bill.createdBy === username || bill.payers.includes(username))
    .reduce((acc, bill) => {
      if (!acc[bill.createdBy]) {
        acc[bill.createdBy] = []
      }
      acc[bill.createdBy].push(bill)
      return acc
    }, {} as Record<string, Bill[]>)

  // Calculate totals for each creator
  const creatorTotals = Object.entries(billsByCreator).reduce((acc, [creator, bills]) => {
    acc[creator] = bills.reduce((sum, bill) => {
      // If user is a payer, only count their share
      if (bill.payers.includes(username) && bill.createdBy !== username) {
        return sum + (bill.amount / bill.payers.length)
      }
      // If user is the creator, count the full amount
      return sum + bill.amount
    }, 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen">
      <SumikkoHeader username={username} showBackButton />
      
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
                onChange={handleBillNameChange}
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
                onChange={handleBillAmountChange}
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
                Select who needs to pay this bill (bill creator is excluded)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {users.map((user) => (
                  <div key={user.username} className="flex items-center space-x-2">
                    <Checkbox
                      id={`payer-${user.username}`}
                      checked={selectedPayers.includes(user.username)}
                      onCheckedChange={() => togglePayer(user.username)}
                      className="sumikko-checkbox"
                    />
                    <Label 
                      htmlFor={`payer-${user.username}`}
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
              onClick={addBill}
              disabled={!newBillName || !newBillAmount || selectedPayers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </SumikkoCard>

        {Object.entries(billsByCreator).map(([creator, creatorBills]) => (
          <SumikkoCard
            key={creator}
            title={creator === username ? "Bills You Created" : `Bills From ${creator}`}
            subtitle={creator === username 
              ? `Total amount: $${creatorTotals[creator].toFixed(2)}`
              : `Your share: $${creatorTotals[creator].toFixed(2)}`
            }
          >
            <ul className="space-y-4">
              {creatorBills.map((bill) => (
                <li key={bill.id} className="flex items-center justify-between gap-4 sumikko-list-item">
                  <div>
                    <div className="font-medium">{bill.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {creator === username ? (
                        <>Total: ${bill.amount.toFixed(2)} • ${getAmountPerPerson(bill.amount, bill.payers.length)} each</>
                      ) : (
                        <>Your share: ${getAmountPerPerson(bill.amount, bill.payers.length)}</>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {creator === username ? (
                        <>To be paid by: {bill.payers.join(", ")}</>
                      ) : (
                        <>Other payers: {bill.payers.filter(payer => payer !== username).join(", ")}</>
                      )}
                    </div>
                  </div>
                  {creator === username && (
                    <Button
                      className={buttonVariants({ variant: "destructive", size: "sm", className: "rounded-full" })}
                      onClick={() => deleteBill(bill.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SumikkoCard>
        ))}
      </div>
    </div>
  )
} 