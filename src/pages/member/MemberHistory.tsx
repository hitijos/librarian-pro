import { useEffect, useState } from "react";
import { BookOpen, CheckCircle, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface HistoryItem {
  id: string;
  book_title: string;
  book_author: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number | null;
  fine_paid: boolean | null;
}

export default function MemberHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('member_transactions')
        .select(`
          id,
          checkout_date,
          due_date,
          return_date,
          status,
          fine_amount,
          fine_paid,
          books (title, author)
        `)
        .eq('user_id', user.id)
        .order('checkout_date', { ascending: false });

      if (error) throw error;

      setHistory(
        (data || []).map((t) => ({
          id: t.id,
          book_title: (t.books as any)?.title || 'Unknown Book',
          book_author: (t.books as any)?.author || 'Unknown Author',
          checkout_date: t.checkout_date,
          due_date: t.due_date,
          return_date: t.return_date,
          status: t.status,
          fine_amount: t.fine_amount,
          fine_paid: t.fine_paid,
        }))
      );
    } catch (error) {
      console.error('Error fetching history:', error);
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

  const getStatusBadge = (item: HistoryItem) => {
    if (item.status === 'returned') {
      return (
        <Badge className="bg-emerald-500 text-white">
          <CheckCircle className="w-3 h-3 mr-1" /> Returned
        </Badge>
      );
    }
    if (item.status === 'overdue') {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Overdue
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 mr-1" /> Borrowed
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Borrowing History</h1>
        <p className="text-muted-foreground">Your complete borrowing history</p>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">No borrowing history</h3>
            <p className="text-muted-foreground">
              You haven't borrowed any books yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-16 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{item.book_title}</h3>
                        <p className="text-sm text-muted-foreground">{item.book_author}</p>
                      </div>
                      {getStatusBadge(item)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Borrowed: {formatDate(item.checkout_date)}</span>
                      <span>Due: {formatDate(item.due_date)}</span>
                      {item.return_date && (
                        <span>Returned: {formatDate(item.return_date)}</span>
                      )}
                      {item.fine_amount && item.fine_amount > 0 && (
                        <span className={item.fine_paid ? "text-emerald-600" : "text-destructive"}>
                          Fine: ₦{item.fine_amount.toLocaleString()}
                          {item.fine_paid ? " (Paid)" : " (Unpaid)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}