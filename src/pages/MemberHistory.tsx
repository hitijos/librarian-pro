import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, AlertCircle, DollarSign, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";

interface Member {
  id: string;
  full_name: string;
  email: string;
  member_id: string;
  phone: string | null;
  join_date: string;
  status: "active" | "inactive" | "suspended";
}

interface Transaction {
  id: string;
  book_id: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  status: "borrowed" | "returned" | "overdue";
  fine_amount: number;
  fine_paid: boolean;
  notes: string | null;
  books: {
    title: string;
    author: string;
    isbn: string | null;
  };
}

interface Stats {
  totalBorrowed: number;
  currentBorrowed: number;
  overdue: number;
  totalFines: number;
  unpaidFines: number;
}

export default function MemberHistory() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBorrowed: 0,
    currentBorrowed: 0,
    overdue: 0,
    totalFines: 0,
    unpaidFines: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (memberId) {
      fetchData();
    }
  }, [memberId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchMember(), fetchTransactions()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMember = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load member details",
        variant: "destructive",
      });
      navigate("/members");
      return;
    }

    setMember(data);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        books!inner(title, author, isbn)
      `)
      .eq("member_id", memberId)
      .order("checkout_date", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load transaction history",
        variant: "destructive",
      });
      return;
    }

    // Update overdue status and calculate stats
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

    // Calculate statistics
    const totalBorrowed = updatedData.length;
    const currentBorrowed = updatedData.filter((t) => t.status === "borrowed").length;
    const overdue = updatedData.filter((t) => t.status === "overdue").length;
    const totalFines = updatedData.reduce((sum, t) => sum + (t.fine_amount || 0), 0);
    const unpaidFines = updatedData
      .filter((t) => !t.fine_paid && t.fine_amount > 0)
      .reduce((sum, t) => sum + t.fine_amount, 0);

    setStats({
      totalBorrowed,
      currentBorrowed,
      overdue,
      totalFines,
      unpaidFines,
    });
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

  const filteredTransactions = transactions.filter((transaction) => {
    if (activeTab === "all") return true;
    if (activeTab === "current") return transaction.status === "borrowed" || transaction.status === "overdue";
    if (activeTab === "overdue") return transaction.status === "overdue";
    if (activeTab === "returned") return transaction.status === "returned";
    if (activeTab === "fines") return transaction.fine_amount > 0;
    return true;
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

  if (loading || !member) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/members")} className="mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{member.full_name}</h1>
            <Badge variant="outline" className={getStatusColor(member.status)}>
              {member.status}
            </Badge>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <p>Member ID: <span className="font-mono font-semibold">{member.member_id}</span></p>
            <p>Email: {member.email}</p>
            {member.phone && <p>Phone: {member.phone}</p>}
            <p>Joined: {format(new Date(member.join_date), "MMMM d, yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Borrowed
            </CardTitle>
            <BookOpen className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalBorrowed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently Borrowed
            </CardTitle>
            <BookOpen className="w-4 h-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.currentBorrowed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.overdue}</div>
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
            <div className="text-2xl font-bold text-foreground">
              ₦{stats.totalFines.toLocaleString()}
            </div>
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
            <div className="text-2xl font-bold text-foreground">
              ₦{stats.unpaidFines.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Borrowing History</CardTitle>
          <CardDescription>
            Complete transaction history for this member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                All ({transactions.length})
              </TabsTrigger>
              <TabsTrigger value="current">
                Current ({stats.currentBorrowed})
              </TabsTrigger>
              <TabsTrigger value="overdue">
                Overdue ({stats.overdue})
              </TabsTrigger>
              <TabsTrigger value="returned">
                Returned ({transactions.filter((t) => t.status === "returned").length})
              </TabsTrigger>
              <TabsTrigger value="fines">
                With Fines ({transactions.filter((t) => t.fine_amount > 0).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Book</TableHead>
                      <TableHead>Checkout Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Return Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading transactions...
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
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
                          <TableCell>
                            {transaction.return_date ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {format(new Date(transaction.return_date), "MMM d, yyyy")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not returned</span>
                            )}
                          </TableCell>
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
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
