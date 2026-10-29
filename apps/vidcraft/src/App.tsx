import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Home } from "@/pages/Home";
import { NewProject } from "@/pages/NewProject";
import { Studio } from "@/pages/Studio";
import "./App.css";

type View =
  | { kind: "home" }
  | { kind: "new-project" }
  | { kind: "studio"; projectId: string };

function App() {
  const [view, setView] = useState<View>({ kind: "home" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      {view.kind === "home" && (
        <Home
          onOpenProject={(projectId) => setView({ kind: "studio", projectId })}
          onNewProject={() => setView({ kind: "new-project" })}
        />
      )}
      {view.kind === "new-project" && (
        <NewProject
          onCancel={() => setView({ kind: "home" })}
          onCreated={(projectId) => setView({ kind: "studio", projectId })}
        />
      )}
      {view.kind === "studio" && (
        <Studio
          projectId={view.projectId}
          onBack={() => setView({ kind: "home" })}
        />
      )}
    </div>
  );
}

export default App;
