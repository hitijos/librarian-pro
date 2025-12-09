import { useEffect, useState } from "react";
import { DollarSign, BookOpen, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface FineItem {
  id: string;
  book_title: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  fine_amount: number;
  fine_paid: boolean;
}

export default function MemberFines() {
  const [fines, setFines] = useState<FineItem[]>([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFines();
  }, []);

  const fetchFines = async () => {
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
          fine_amount,
          fine_paid,
          books (title)
        `)
        .eq('user_id', user.id)
        .gt('fine_amount', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const finesData = (data || []).map((t) => ({
        id: t.id,
        book_title: (t.books as any)?.title || 'Unknown Book',
        checkout_date: t.checkout_date,
        due_date: t.due_date,
        return_date: t.return_date,
        fine_amount: Number(t.fine_amount),
        fine_paid: t.fine_paid || false,
      }));

      setFines(finesData);

      const unpaid = finesData
        .filter((f) => !f.fine_paid)
        .reduce((sum, f) => sum + f.fine_amount, 0);
      const paid = finesData
        .filter((f) => f.fine_paid)
        .reduce((sum, f) => sum + f.fine_amount, 0);

      setTotalUnpaid(unpaid);
      setTotalPaid(paid);
    } catch (error) {
      console.error('Error fetching fines:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading fines...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fines</h1>
        <p className="text-muted-foreground">Manage your library fines</p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className={totalUnpaid > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid Fines
            </CardTitle>
            <AlertTriangle className={`w-4 h-4 ${totalUnpaid > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalUnpaid > 0 ? 'text-destructive' : 'text-foreground'}`}>
              ₦{totalUnpaid.toLocaleString()}
            </p>
            {totalUnpaid > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Please visit the library to pay
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid Fines
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ₦{totalPaid.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total fines paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Notice */}
      {totalUnpaid > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Payment Information</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To pay your fines, please visit the library during operating hours. 
                  Accepted payment methods include cash and bank transfer.
                  Unpaid fines may restrict your ability to borrow new books.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fines List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fine History</CardTitle>
        </CardHeader>
        <CardContent>
          {fines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-50" />
              <p className="font-medium">No fines!</p>
              <p className="text-sm">You don't have any fines on your account</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fines.map((fine) => (
                <div
                  key={fine.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    fine.fine_paid ? 'bg-muted/30' : 'bg-destructive/5 border-destructive/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{fine.book_title}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {formatDate(fine.due_date)}
                        {fine.return_date && ` • Returned: ${formatDate(fine.return_date)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${fine.fine_paid ? 'text-muted-foreground' : 'text-destructive'}`}>
                      ₦{fine.fine_amount.toLocaleString()}
                    </p>
                    <Badge
                      variant={fine.fine_paid ? "secondary" : "destructive"}
                      className="mt-1"
                    >
                      {fine.fine_paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}