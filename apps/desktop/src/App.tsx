import React from 'react';

const App: React.FC = () => (
  <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground p-6">
    <p className="text-muted-foreground text-center">
      Run <code className="rounded bg-muted px-2 py-1">pnpm tauri:dev</code> for the full Qwery Desktop experience.
    </p>
  </div>
);

export default App;
