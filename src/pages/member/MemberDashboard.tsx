import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, BookMarked, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  currentlyBorrowed: number;
  overdueBooks: number;
  totalFines: number;
  booksRead: number;
}

interface BorrowedBook {
  id: string;
  book_title: string;
  due_date: string;
  is_overdue: boolean;
}

export default function MemberDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    currentlyBorrowed: 0,
    overdueBooks: 0,
    totalFines: 0,
    booksRead: 0,
  });
  const [currentBooks, setCurrentBooks] = useState<BorrowedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch member transactions
      const { data: transactions, error } = await supabase
        .from('member_transactions')
        .select(`
          id,
          status,
          due_date,
          fine_amount,
          fine_paid,
          book_id,
          books (title)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const now = new Date();
      const currentlyBorrowed = transactions?.filter(t => t.status === 'borrowed' || t.status === 'overdue') || [];
      const overdueBooks = currentlyBorrowed.filter(t => new Date(t.due_date) < now);
      const totalUnpaidFines = transactions?.reduce((sum, t) => {
        if (t.fine_amount && !t.fine_paid) {
          return sum + Number(t.fine_amount);
        }
        return sum;
      }, 0) || 0;
      const booksRead = transactions?.filter(t => t.status === 'returned').length || 0;

      setStats({
        currentlyBorrowed: currentlyBorrowed.length,
        overdueBooks: overdueBooks.length,
        totalFines: totalUnpaidFines,
        booksRead,
      });

      // Set current books for display
      setCurrentBooks(
        currentlyBorrowed.slice(0, 5).map(t => ({
          id: t.id,
          book_title: (t.books as any)?.title || 'Unknown Book',
          due_date: t.due_date,
          is_overdue: new Date(t.due_date) < now,
        }))
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statsCards = [
    {
      title: "Currently Borrowed",
      value: stats.currentlyBorrowed,
      icon: BookMarked,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Overdue Books",
      value: stats.overdueBooks,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Unpaid Fines",
      value: `₦${stats.totalFines.toLocaleString()}`,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Books Read",
      value: stats.booksRead,
      icon: BookOpen,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome Back!</h1>
        <p className="text-muted-foreground">Here's an overview of your library activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Current Books */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Currently Borrowed Books</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/member-portal/my-books" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {currentBooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No books currently borrowed</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/member-portal/books">Browse Books</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{book.book_title}</p>
                      <p className={`text-sm ${book.is_overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {book.is_overdue ? 'Overdue since ' : 'Due '}
                        {formatDate(book.due_date)}
                      </p>
                    </div>
                  </div>
                  {book.is_overdue && (
                    <span className="px-2 py-1 text-xs font-medium bg-destructive/10 text-destructive rounded">
                      Overdue
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-primary text-primary-foreground hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <BookOpen className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Browse Books</h3>
            <p className="text-primary-foreground/80 text-sm mb-4">
              Explore our collection and find your next read
            </p>
            <Button variant="secondary" asChild>
              <Link to="/member-portal/books">Browse Now</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <Clock className="w-8 h-8 mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Borrowing History</h3>
            <p className="text-muted-foreground text-sm mb-4">
              View your complete reading history
            </p>
            <Button variant="outline" asChild>
              <Link to="/member-portal/history">View History</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}