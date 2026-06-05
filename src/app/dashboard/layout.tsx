import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:ml-[64px] min-h-screen flex flex-col pb-20 lg:pb-0">
        <TopBar />
        <div className="flex-1 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
