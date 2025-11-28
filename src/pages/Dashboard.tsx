import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, BookMarked, AlertTriangle, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalBooks: number;
  availableBooks: number;
  totalMembers: number;
  borrowedBooks: number;
  overdueItems: number;
  totalFines: number;
  unpaidFines: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0,
    availableBooks: 0,
    totalMembers: 0,
    borrowedBooks: 0,
    overdueItems: 0,
    totalFines: 0,
    unpaidFines: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch books stats
      const { data: books, error: booksError } = await supabase
        .from("books")
        .select("total_copies, available_copies");

      if (booksError) throw booksError;

      const totalBooks = books?.reduce((sum, book) => sum + book.total_copies, 0) || 0;
      const availableBooks = books?.reduce((sum, book) => sum + book.available_copies, 0) || 0;

      // Fetch members count
      const { count: membersCount, error: membersError } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true });

      if (membersError) throw membersError;

      // Fetch borrowed books count
      const { count: borrowedCount, error: borrowedError } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "borrowed");

      if (borrowedError) throw borrowedError;

      // Fetch overdue items count (due_date < now and status = borrowed)
      const { count: overdueCount, error: overdueError } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "borrowed")
        .lt("due_date", new Date().toISOString());

      if (overdueError) throw overdueError;

      // Fetch fine statistics
      const { data: fineData, error: fineError } = await supabase
        .from("transactions")
        .select("fine_amount, fine_paid");

      if (fineError) throw fineError;

      const totalFines = fineData?.reduce((sum, t) => sum + (t.fine_amount || 0), 0) || 0;
      const unpaidFines = fineData
        ?.filter((t) => !t.fine_paid && t.fine_amount > 0)
        .reduce((sum, t) => sum + t.fine_amount, 0) || 0;

      setStats({
        totalBooks,
        availableBooks,
        totalMembers: membersCount || 0,
        borrowedBooks: borrowedCount || 0,
        overdueItems: overdueCount || 0,
        totalFines,
        unpaidFines,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Books",
      value: stats.totalBooks,
      icon: BookOpen,
      color: "text-primary",
      bgColor: "bg-primary/10",
      isNumber: true,
    },
    {
      title: "Available Books",
      value: stats.availableBooks,
      icon: BookMarked,
      color: "text-success",
      bgColor: "bg-success/10",
      isNumber: true,
    },
    {
      title: "Total Members",
      value: stats.totalMembers,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
      isNumber: true,
    },
    {
      title: "Borrowed Books",
      value: stats.borrowedBooks,
      icon: BookOpen,
      color: "text-warning",
      bgColor: "bg-warning/10",
      isNumber: true,
    },
    {
      title: "Overdue Items",
      value: stats.overdueItems,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      isNumber: true,
    },
    {
      title: "Total Fines",
      value: stats.totalFines,
      icon: DollarSign,
      color: "text-warning",
      bgColor: "bg-warning/10",
      isNumber: false,
      isCurrency: true,
    },
    {
      title: "Unpaid Fines",
      value: stats.unpaidFines,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      isNumber: false,
      isCurrency: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to Librarian Pro - Your Library Management System
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="relative overflow-hidden border-border/50 hover:border-border transition-all hover:shadow-lg group"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-foreground">
                  {loading ? "..." : stat.isCurrency ? `₦${stat.value.toLocaleString()}` : stat.value}
                </div>
              </CardContent>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${stat.bgColor}`}></div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/books" className="group p-6 border border-border rounded-xl hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer hover:shadow-md">
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">Manage Books</h3>
              <p className="text-sm text-muted-foreground">
                Add, edit, or remove books from your library collection
              </p>
            </Link>
            <Link to="/borrowing" className="group p-6 border border-border rounded-xl hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer hover:shadow-md">
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">Check Out Book</h3>
              <p className="text-sm text-muted-foreground">
                Process book checkouts and returns for members
              </p>
            </Link>
            <Link to="/members" className="group p-6 border border-border rounded-xl hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer hover:shadow-md">
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">Manage Members</h3>
              <p className="text-sm text-muted-foreground">
                Add, edit, or manage library members
              </p>
            </Link>
            <Link to="/borrowing" className="group p-6 border border-border rounded-xl hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer hover:shadow-md">
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">Manage Fines</h3>
              <p className="text-sm text-muted-foreground">
                View overdue items and manage late fee payments
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
