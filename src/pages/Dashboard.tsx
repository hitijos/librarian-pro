import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, BookMarked, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalBooks: number;
  availableBooks: number;
  totalMembers: number;
  borrowedBooks: number;
  overdueItems: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0,
    availableBooks: 0,
    totalMembers: 0,
    borrowedBooks: 0,
    overdueItems: 0,
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

      setStats({
        totalBooks,
        availableBooks,
        totalMembers: membersCount || 0,
        borrowedBooks: borrowedCount || 0,
        overdueItems: overdueCount || 0,
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
    },
    {
      title: "Available Books",
      value: stats.availableBooks,
      icon: BookMarked,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Total Members",
      value: stats.totalMembers,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Borrowed Books",
      value: stats.borrowedBooks,
      icon: BookOpen,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Overdue Items",
      value: stats.overdueItems,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/books" className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
              <h3 className="font-semibold text-foreground mb-1">Manage Books</h3>
              <p className="text-sm text-muted-foreground">
                Add, edit, or remove books from your library collection
              </p>
            </Link>
            <Link to="/borrowing" className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
              <h3 className="font-semibold text-foreground mb-1">Check Out Book</h3>
              <p className="text-sm text-muted-foreground">
                Process book checkouts and returns for members
              </p>
            </Link>
            <Link to="/members" className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
              <h3 className="font-semibold text-foreground mb-1">Manage Members</h3>
              <p className="text-sm text-muted-foreground">
                Add, edit, or manage library members
              </p>
            </Link>
            <div className="p-4 border border-border rounded-lg bg-muted/30 cursor-not-allowed opacity-60">
              <h3 className="font-semibold text-foreground mb-1">View Overdue</h3>
              <p className="text-sm text-muted-foreground">
                Check and manage overdue books (Coming soon)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
