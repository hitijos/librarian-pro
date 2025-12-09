import { Link } from "react-router-dom";
import { BookOpen, Users, BookMarked, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
export default function Home() {
  const carouselItems = [{
    title: "Welcome to Our Library",
    description: "Discover thousands of books and resources at Ikiwa City Hall Library",
    image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&h=600&fit=crop"
  }, {
    title: "Digital Collection",
    description: "Access our extensive digital catalog anytime, anywhere",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=600&fit=crop"
  }, {
    title: "Community Hub",
    description: "Join our vibrant community of readers and learners",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&h=600&fit=crop"
  }];
  const features = [{
    icon: BookOpen,
    title: "Vast Collection",
    description: "Access thousands of books across all genres and categories"
  }, {
    icon: Users,
    title: "Member Services",
    description: "Easy registration and personalized borrowing experience"
  }, {
    icon: BookMarked,
    title: "Simple Borrowing",
    description: "Quick check-out process with automatic due date reminders"
  }];
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ikiwa City Hall Library</h1>
              <p className="text-sm text-muted-foreground">Your Gateway to Knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/member-auth">Member Login</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Staff Login</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Carousel */}
      <section className="container mx-auto px-4 py-12">
        <Carousel className="w-full max-w-5xl mx-auto">
          <CarouselContent>
            {carouselItems.map((item, index) => <CarouselItem key={index}>
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative h-[400px] lg:h-[500px]">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12 text-white">
                        <h2 className="text-3xl lg:text-5xl font-bold mb-4">{item.title}</h2>
                        <p className="text-lg lg:text-xl text-white/90 max-w-2xl">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>)}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Why Choose Our Library
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience the best in modern library services with our comprehensive collection
            and user-friendly systems
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => {
          const Icon = feature.icon;
          return <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>;
        })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Start Your Reading Journey?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Visit us today or contact our staff to learn more about membership options
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth" className="gap-2">
              Staff Portal <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Ikiwa City Hall Library. All rights reserved.</p>
        </div>
      </footer>
    </div>;
}