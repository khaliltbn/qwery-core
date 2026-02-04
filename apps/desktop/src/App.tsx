import React, { useEffect, useState } from 'react';
import { Command } from "@tauri-apps/plugin-shell";
import { Button } from "@qwery/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@qwery/ui/card";
import { Spinner } from "@qwery/ui/spinner";
import { Terminal, Database, Globe } from "lucide-react";

const App: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
    const [message, setMessage] = useState('Initializing application...');

    useEffect(() => {
        const startSidecar = async () => {
            try {
                setStatus('starting');
                setMessage('Starting background services...');

                // Spawning the node sidecar
                // Note: The path "../../cli/dist/index.js" is relative to the binary location in dev
                const sidecar = Command.create("node", ["../../cli/dist/index.js"]);

                sidecar.on('close', data => {
                    console.log(`sidecar closed with code ${data.code}`);
                    if (data.code !== 0) {
                        setStatus('error');
                        setMessage('Background services closed unexpectedly.');
                    }
                });

                sidecar.on('error', error => {
                    console.error(`sidecar error: ${error}`);
                    setStatus('error');
                    setMessage(`Error starting background services: ${error}`);
                });

                await sidecar.spawn();

                setStatus('ready');
                setMessage('Desktop services running.');
            } catch (err) {
                console.error('Failed to spawn sidecar:', err);
                setStatus('error');
                setMessage('Failed to initialize desktop services.');
            }
        };

        startSidecar();
    }, []);

    const openWebUI = () => {
        // In a real scenario, this might open a new window or navigate
        window.location.href = 'http://localhost:3000';
    };

    return (
        <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground p-6">
            <Card className="w-full max-w-md shadow-2xl border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Database className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Qwery Desktop</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                        {status === 'starting' && <Spinner className="text-primary" />}
                        {status === 'ready' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
                        {status === 'error' && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
                        {status === 'idle' && <div className="w-2 h-2 rounded-full bg-yellow-500" />}
                        <span className="text-sm font-medium">{message}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <Button
                            variant="default"
                            size="lg"
                            className="w-full h-12 gap-2 text-md font-semibold transition-all hover:scale-[1.02]"
                            disabled={status !== 'ready'}
                            onClick={openWebUI}
                        >
                            <Globe className="w-5 h-5" />
                            Launch Web Experience
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full h-12 gap-2 text-md font-medium"
                            onClick={() => window.open('https://docs.qwery.com', '_blank')}
                        >
                            <Terminal className="w-5 h-5" />
                            Documentation
                        </Button>
                    </div>
                </CardContent>
                <div className="px-6 pb-6 text-center">
                    <p className="text-xs text-muted-foreground opacity-70">
                        Version 0.0.1 • Connected to Tauri Runtime
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default App;
