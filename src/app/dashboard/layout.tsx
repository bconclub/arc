import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Pet } from "@/components/Pet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:ml-[200px] min-h-screen flex flex-col pb-20 lg:pb-0">
        <TopBar />
        <div className="flex-1 animate-fade-in">
          {children}
        </div>
      </main>
      <Pet />
    </div>
  );
}
