import { useEffect, useState } from "react";
import { BookOpen, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface BorrowedBook {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  checkout_date: string;
  due_date: string;
  status: string;
  fine_amount: number | null;
}

export default function MyBooks() {
  const [books, setBooks] = useState<BorrowedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBooks();
  }, []);

  const fetchMyBooks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('member_transactions')
        .select(`
          id,
          book_id,
          checkout_date,
          due_date,
          status,
          fine_amount,
          books (title, author)
        `)
        .eq('user_id', user.id)
        .in('status', ['borrowed', 'overdue'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      setBooks(
        (data || []).map((t) => ({
          id: t.id,
          book_id: t.book_id,
          book_title: (t.books as any)?.title || 'Unknown Book',
          book_author: (t.books as any)?.author || 'Unknown Author',
          checkout_date: t.checkout_date,
          due_date: t.due_date,
          status: t.status,
          fine_amount: t.fine_amount,
        }))
      );
    } catch (error) {
      console.error('Error fetching my books:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemaining = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading your books...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Books</h1>
        <p className="text-muted-foreground">Books you currently have borrowed</p>
      </div>

      {books.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">No books borrowed</h3>
            <p className="text-muted-foreground">
              Visit the library or browse our catalog to borrow books
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {books.map((book) => {
            const daysRemaining = getDaysRemaining(book.due_date);
            const isOverdue = daysRemaining < 0;
            const isDueSoon = daysRemaining <= 3 && daysRemaining >= 0;

            return (
              <Card
                key={book.id}
                className={`${
                  isOverdue
                    ? "border-destructive/50 bg-destructive/5"
                    : isDueSoon
                    ? "border-amber-500/50 bg-amber-500/5"
                    : ""
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-16 h-20 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground">{book.book_title}</h3>
                          <p className="text-sm text-muted-foreground">{book.book_author}</p>
                        </div>
                        <Badge
                          variant={isOverdue ? "destructive" : isDueSoon ? "outline" : "secondary"}
                          className={isDueSoon && !isOverdue ? "border-amber-500 text-amber-600" : ""}
                        >
                          {isOverdue ? (
                            <><AlertTriangle className="w-3 h-3 mr-1" /> Overdue</>
                          ) : isDueSoon ? (
                            <><Clock className="w-3 h-3 mr-1" /> Due Soon</>
                          ) : (
                            "Borrowed"
                          )}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Borrowed: </span>
                          <span className="text-foreground">{formatDate(book.checkout_date)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Due: </span>
                          <span className={`font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                            {formatDate(book.due_date)}
                          </span>
                        </div>
                        {isOverdue && book.fine_amount && book.fine_amount > 0 && (
                          <div>
                            <span className="text-muted-foreground">Fine: </span>
                            <span className="text-destructive font-medium">
                              ₦{book.fine_amount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      {isOverdue && (
                        <p className="mt-2 text-sm text-destructive">
                          This book is {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue. 
                          Please return it to avoid additional fines.
                        </p>
                      )}
                      {isDueSoon && !isOverdue && (
                        <p className="mt-2 text-sm text-amber-600">
                          {daysRemaining === 0
                            ? "This book is due today!"
                            : `This book is due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}