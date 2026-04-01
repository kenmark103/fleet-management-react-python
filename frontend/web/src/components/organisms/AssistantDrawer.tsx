import { useMemo, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Textarea } from "../ui/textarea";
import { useAssistantChat, useAssistantSuggestions } from "../../hooks/useAssistant";
import type { AssistantMessage } from "../../types/assistant";

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const suggestions = useAssistantSuggestions();
  const chat = useAssistantChat();

  const disabled = useMemo(() => !input.trim() || chat.isPending, [input, chat.isPending]);

  const submit = async (prompt?: string) => {
    const message = (prompt ?? input).trim();
    if (!message) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: message }]);
    if (!prompt) setInput("");

    const response = await chat.mutateAsync({ message, sessionId });
    setSessionId(response.sessionId);
    setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: response.message }]);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-12 rounded-full px-4 shadow-lg"
      >
        <Bot className="mr-2 h-4 w-4" />
        Assistant
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-xl sm:max-w-xl p-0">
          <SheetHeader className="border-b bg-muted/20">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Fleet Assistant
            </SheetTitle>
            <SheetDescription>
              Ask about overdue work orders, truck status, route plans, and driver issues.
            </SheetDescription>
          </SheetHeader>

          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {suggestions.data?.suggestions.slice(0, 4).map((item) => (
                  <Button key={item.title} variant="outline" size="sm" onClick={() => submit(item.prompt)}>
                    {item.title}
                  </Button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Try: "Show overdue work orders", "Find truck by plate", or "Summarize driver issues".
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={message.role === "assistant"
                        ? "max-w-[90%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm"
                        : "ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                      }
                    >
                      {message.content}
                    </div>
                  ))
                )}
                {chat.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                )}
              </div>
            </div>

            <div className="border-t p-4">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the assistant a fleet question..."
                  className="min-h-[88px]"
                />
                <Button type="button" onClick={() => submit()} disabled={disabled} className="self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
