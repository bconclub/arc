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
        <div className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 animate-fade-in">
          <div className="max-w-dashboard mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
