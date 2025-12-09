import { useEffect, useState } from "react";
import { Search, BookOpen, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Book = Tables<'books'>;

export default function MemberBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowingBookId, setBorrowingBookId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    filterBooks();
  }, [books, searchQuery, categoryFilter]);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('title');

      if (error) throw error;

      setBooks(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(b => b.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching books:', error);
      toast({
        title: "Error",
        description: "Failed to load books",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterBooks = () => {
    let filtered = books;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query) ||
          book.isbn?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter && categoryFilter !== "all") {
      filtered = filtered.filter((book) => book.category === categoryFilter);
    }

    setFilteredBooks(filtered);
  };

  const handleBorrowBook = async (bookId: string) => {
    setBorrowingBookId(bookId);
    try {
      const { data, error } = await supabase.rpc('member_checkout_book', {
        p_book_id: bookId,
        p_due_days: 14,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Book borrowed successfully. Due in 14 days.",
      });

      // Refresh books list
      fetchBooks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to borrow book",
        variant: "destructive",
      });
    } finally {
      setBorrowingBookId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading books...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Browse Books</h1>
        <p className="text-muted-foreground">Explore our collection and borrow books</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, author, or ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Books Grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No books found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBooks.map((book) => (
            <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-[3/4] bg-muted relative">
                {book.cover_image_url ? (
                  <img
                    src={book.cover_image_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <BookOpen className="w-16 h-16 text-primary/40" />
                  </div>
                )}
                <Badge
                  className={`absolute top-2 right-2 ${
                    book.available_copies > 0
                      ? "bg-emerald-500 text-white"
                      : "bg-destructive text-destructive-foreground"
                  }`}
                >
                  {book.available_copies > 0 ? `${book.available_copies} available` : "Not available"}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground line-clamp-1">{book.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
                {book.category && (
                  <Badge variant="secondary" className="mt-2">
                    {book.category}
                  </Badge>
                )}
                <Button
                  className="w-full mt-4"
                  disabled={book.available_copies <= 0 || borrowingBookId === book.id}
                  onClick={() => handleBorrowBook(book.id)}
                >
                  {borrowingBookId === book.id
                    ? "Borrowing..."
                    : book.available_copies > 0
                    ? "Borrow Book"
                    : "Not Available"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}