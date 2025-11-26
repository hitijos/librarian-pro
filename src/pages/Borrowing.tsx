import { useEffect, useState } from "react";
import { BookOpen, UserCheck, RotateCcw, Search, Calendar, AlertCircle, DollarSign, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";

interface Transaction {
  id: string;
  member_id: string;
  book_id: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  status: "borrowed" | "returned" | "overdue";
  fine_amount: number;
  fine_paid: boolean;
  members: {
    full_name: string;
    member_id: string;
    email: string;
  };
  books: {
    title: string;
    author: string;
    isbn: string | null;
  };
}

interface Member {
  id: string;
  full_name: string;
  member_id: string;
  status: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  available_copies: number;
}

export default function Borrowing() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [activeTab, setActiveTab] = useState("borrowed");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchMembers(), fetchBooks()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        members!inner(full_name, member_id, email),
        books!inner(title, author, isbn)
      `)
      .order("checkout_date", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
      return;
    }

    // Update overdue status
    const updatedData = (data || []).map((transaction: any) => {
      if (
        transaction.status === "borrowed" &&
        isPast(new Date(transaction.due_date))
      ) {
        return { ...transaction, status: "overdue" as const };
      }
      return transaction;
    });

    setTransactions(updatedData);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("id, full_name, member_id, status")
      .eq("status", "active")
      .order("full_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load members",
        variant: "destructive",
      });
      return;
    }

    setMembers(data || []);
  };

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, available_copies")
      .gt("available_copies", 0)
      .order("title");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load books",
        variant: "destructive",
      });
      return;
    }

    setBooks(data || []);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMemberId || !selectedBookId) {
      toast({
        title: "Validation Error",
        description: "Please select both a member and a book",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc("checkout_book", {
        p_member_id: selectedMemberId,
        p_book_id: selectedBookId,
        p_due_days: 14,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Book checked out successfully",
      });

      setIsCheckoutDialogOpen(false);
      setSelectedMemberId("");
      setSelectedBookId("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to checkout book",
        variant: "destructive",
      });
    }
  };

  const handleReturn = async (transactionId: string) => {
    try {
      const { error } = await supabase.rpc("return_book", {
        p_transaction_id: transactionId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Book returned successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to return book",
        variant: "destructive",
      });
    }
  };

  const handleMarkFinePaid = async (transactionId: string) => {
    try {
      const { error } = await supabase.rpc("mark_fine_paid", {
        p_transaction_id: transactionId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fine marked as paid",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark fine as paid",
        variant: "destructive",
      });
    }
  };

  const calculateFine = async (transactionId: string) => {
    try {
      const { error } = await supabase.rpc("calculate_fine", {
        p_transaction_id: transactionId,
      });

      if (error) throw error;

      fetchData();
    } catch (error: any) {
      console.error("Failed to calculate fine:", error);
    }
  };

  // Calculate fines for overdue items
  useEffect(() => {
    transactions.forEach((transaction) => {
      if (transaction.status === "overdue" && transaction.fine_amount === 0) {
        calculateFine(transaction.id);
      }
    });
  }, [transactions]);

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      transaction.members.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.members.member_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.books.title.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "borrowed") {
      return matchesSearch && transaction.status === "borrowed";
    } else if (activeTab === "overdue") {
      return matchesSearch && transaction.status === "overdue";
    } else {
      return matchesSearch && transaction.status === "returned";
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "borrowed":
        return "bg-info/10 text-info border-info/20";
      case "returned":
        return "bg-success/10 text-success border-success/20";
      case "overdue":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const borrowedCount = transactions.filter((t) => t.status === "borrowed").length;
  const overdueCount = transactions.filter((t) => t.status === "overdue").length;
  const returnedCount = transactions.filter((t) => t.status === "returned").length;
  const totalFines = transactions.reduce((sum, t) => sum + (t.fine_amount || 0), 0);
  const unpaidFines = transactions
    .filter((t) => !t.fine_paid && t.fine_amount > 0)
    .reduce((sum, t) => sum + t.fine_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Borrowing System</h1>
          <p className="text-muted-foreground mt-1">
            Manage book checkouts and returns
          </p>
        </div>
        <Button
          onClick={() => setIsCheckoutDialogOpen(true)}
          className="gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Check Out Book
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently Borrowed
            </CardTitle>
            <BookOpen className="w-4 h-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{borrowedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Items
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overdueCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Fines
            </CardTitle>
            <DollarSign className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totalFines.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid Fines
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{unpaidFines.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Returned Today
            </CardTitle>
            <RotateCcw className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {transactions.filter(
                (t) =>
                  t.return_date &&
                  format(new Date(t.return_date), "yyyy-MM-dd") ===
                    format(new Date(), "yyyy-MM-dd")
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>View and manage book borrowing transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by member, book title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="borrowed">
                  Borrowed ({borrowedCount})
                </TabsTrigger>
                <TabsTrigger value="overdue">
                  Overdue ({overdueCount})
                </TabsTrigger>
                <TabsTrigger value="returned">
                  Returned ({returnedCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Member</TableHead>
                        <TableHead>Book</TableHead>
                        <TableHead>Checkout Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        {activeTab === "returned" && <TableHead>Return Date</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={activeTab === "returned" ? 8 : 8}
                            className="text-center py-8 text-muted-foreground"
                          >
                            Loading transactions...
                          </TableCell>
                        </TableRow>
                      ) : filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={activeTab === "returned" ? 8 : 8}
                            className="text-center py-8 text-muted-foreground"
                          >
                            {searchQuery
                              ? "No transactions found matching your search"
                              : `No ${activeTab} transactions`}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-foreground">
                                  {transaction.members.full_name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {transaction.members.member_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-foreground">
                                  {transaction.books.title}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  by {transaction.books.author}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {format(new Date(transaction.checkout_date), "MMM d, yyyy")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {format(new Date(transaction.due_date), "MMM d, yyyy")}
                              </div>
                            </TableCell>
                            {activeTab === "returned" && transaction.return_date && (
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  {format(new Date(transaction.return_date), "MMM d, yyyy")}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={getStatusColor(transaction.status)}
                              >
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {transaction.fine_amount > 0 ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">
                                    ₦{transaction.fine_amount.toLocaleString()}
                                  </div>
                                  {transaction.fine_paid ? (
                                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                      <Check className="w-3 h-3 mr-1" />
                                      Paid
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                      Unpaid
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No fine</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {activeTab !== "returned" && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleReturn(transaction.id)}
                                    className="gap-2"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Return
                                  </Button>
                                )}
                                {transaction.fine_amount > 0 && !transaction.fine_paid && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkFinePaid(transaction.id)}
                                    className="gap-2"
                                  >
                                    <Check className="w-3 h-3" />
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Check Out Book</DialogTitle>
            <DialogDescription>
              Select a member and book to create a new checkout transaction
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member">
                Member <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} ({member.member_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="book">
                Book <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedBookId} onValueChange={setSelectedBookId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  {books.map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.title} by {book.author} ({book.available_copies} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Checkout Information</p>
                  <p>Due date will be automatically set to 14 days from today.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCheckoutDialogOpen(false);
                  setSelectedMemberId("");
                  setSelectedBookId("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Check Out Book</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
