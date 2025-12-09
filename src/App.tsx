import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import MemberLayout from "@/components/MemberLayout";
import MemberProtectedRoute from "@/components/MemberProtectedRoute";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import MemberAuth from "./pages/MemberAuth";
import Dashboard from "./pages/Dashboard";
import Books from "./pages/Books";
import Members from "./pages/Members";
import MemberHistory from "./pages/MemberHistory";
import Borrowing from "./pages/Borrowing";
import NotFound from "./pages/NotFound";
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberBooks from "./pages/member/MemberBooks";
import MyBooks from "./pages/member/MyBooks";
import MemberHistoryPage from "./pages/member/MemberHistory";
import MemberFines from "./pages/member/MemberFines";
import MemberProfile from "./pages/member/MemberProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/member-auth" element={<MemberAuth />} />
          
          {/* Member Portal Routes */}
          <Route path="/member-portal" element={<MemberProtectedRoute><MemberLayout><MemberDashboard /></MemberLayout></MemberProtectedRoute>} />
          <Route path="/member-portal/books" element={<MemberProtectedRoute><MemberLayout><MemberBooks /></MemberLayout></MemberProtectedRoute>} />
          <Route path="/member-portal/my-books" element={<MemberProtectedRoute><MemberLayout><MyBooks /></MemberLayout></MemberProtectedRoute>} />
          <Route path="/member-portal/history" element={<MemberProtectedRoute><MemberLayout><MemberHistoryPage /></MemberLayout></MemberProtectedRoute>} />
          <Route path="/member-portal/fines" element={<MemberProtectedRoute><MemberLayout><MemberFines /></MemberLayout></MemberProtectedRoute>} />
          <Route path="/member-portal/profile" element={<MemberProtectedRoute><MemberLayout><MemberProfile /></MemberLayout></MemberProtectedRoute>} />
          
          {/* Admin/Staff Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/books" element={<ProtectedRoute><Layout><Books /></Layout></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><Layout><Members /></Layout></ProtectedRoute>} />
          <Route path="/members/:memberId/history" element={<ProtectedRoute><Layout><MemberHistory /></Layout></ProtectedRoute>} />
          <Route path="/borrowing" element={<ProtectedRoute><Layout><Borrowing /></Layout></ProtectedRoute>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
