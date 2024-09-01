import {
  type FC,
  type SyntheticEvent,
  useState,
  useEffect,
  useRef,
} from "react";
import { v4 } from "uuid";
import * as webllm from "@mlc-ai/web-llm";
import { marked } from "marked";

type Message = {
  id: string;
  role: "assistant" | "user" | "system" | "tool";
  content: string;
  sentAt: string;
};

const modelId = "TinyLlama-1.1B-Chat-v0.4-q4f32_1-MLC-1k";
const loadEngineProgressKey = "hello-webllm.locals.loading-engine";
const messagesRepoKey = "hello-webllm.locals.messages-repo";

sessionStorage.removeItem(loadEngineProgressKey);

const App: FC = () => {
  const [engine, setEngine] = useState<webllm.MLCEngine | null>(null);
  const [engineLoadingProgress, setEngineLoadingProgress] =
    useState("Preparing 0%");
  const [msgInput, setMsgInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [processingMsg, setProcessingMsg] = useState(false);
  const messagesContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadingStatus = sessionStorage.getItem(loadEngineProgressKey);

    if (loadingStatus === "true") return;

    sessionStorage.setItem(loadEngineProgressKey, "true");
    webllm
      .CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          setEngineLoadingProgress(`${report.text}`);
          // console.log(report);
        },
      })
      .then((e) => {
        setEngine(e);
      })
      .catch((err) => {
        console.error("unable to fully load the model:", err);
      })
      .finally(() => {
        sessionStorage.removeItem(loadEngineProgressKey);
        const msgs = localStorage.getItem(messagesRepoKey);
        try {
          const parsedMsgs = JSON.parse(msgs || "[]") as Message[];
          setMessages(parsedMsgs);
          if (parsedMsgs.length > 0 && parsedMsgs.at(-1)?.role === "user") {
            processMsg(parsedMsgs).then();
          }
        } catch {
          //
        } finally {
          scrollDown();
        }
      });
  }, []);

  useEffect(() => {
    if (messages.length < 1) return;
    localStorage.setItem(messagesRepoKey, JSON.stringify(messages));
  }, [messages]);

  async function processMsg(msgList: Message[]) {
    if (!engine) return;
    setProcessingMsg(true);
    scrollDown();
    try {
      const prompt: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful AI assistant." },
        ...msgList.map((m) => ({ role: m.role, content: m.content })),
      ];
      const reply = await engine.chat.completions.create({
        messages: prompt,
      });
      const choice = reply.choices[0];
      // console.log(choice.message);
      // console.log(reply.usage);
      setMessages((p) => [
        ...p,
        {
          id: v4(),
          content: choice.message.content || "Unable to prduce response!",
          role: choice.message.role,
          sentAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("unable to process message:", err);
    } finally {
      setProcessingMsg(false);
      scrollDown();
    }
  }

  async function sendMsg(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!engine) return;

    const newMsg: Message = {
      id: v4(),
      role: "user",
      content: msgInput,
      sentAt: new Date().toISOString(),
    };
    setMsgInput("");
    const newMsgList = [...messages, newMsg];
    setMessages(newMsgList);
    await processMsg(newMsgList);
  }

  function scrollDown(delay = 100) {
    setTimeout(() => {
      if (!messagesContainer.current) return;
      messagesContainer.current.scrollTo({
        top: messagesContainer.current.getBoundingClientRect().height * 100,
        behavior: "smooth",
      });
    }, delay);
  }

  if (!engine) {
    return (
      <div className="p-6 w-full flex flex-col items-center justify-center gap-4 max-w-xl mx-auto">
        <h3 className="font-bold text-xl">Downloading model</h3>
        <p className="w-full bg-slate-200 text-slate-700 text-sm p-4 rounded font-mono">
          {engineLoadingProgress}
        </p>
        <span className="font-bold animate-pulse">Please wait...</span>
      </div>
    );
  }

  return (
    <main className="w-full max-w-2xl mx-auto flex flex-col p-6 h-screen max-h-screen overflow-hidden gap-y-4 text-slate-600">
      <h3 className="font-bold text-xl">Web LLM</h3>

      <div
        ref={messagesContainer}
        className={`w-full flex flex-col items-start justify-start gap-y-4 h-full max-h-full overflow-y-auto`}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[90%] rounded p-4 ${msg.role === "assistant" ? "bg-slate-100" : "bg-blue-500 text-white self-end"}`}
          >
            <div
              className="content-display"
              dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
            ></div>
          </div>
        ))}
        <div
          className={`rounded px-4 py-2 font-bold text-slate-400 bg-slate-100 ${!processingMsg ? "hidden invisible" : ""}`}
        >
          <span className="inline-block font-bold animate-bounce">.</span>
          <span
            className="inline-block font-bold animate-bounce"
            style={{ animationDelay: "50ms" }}
          >
            .
          </span>
          <span
            className="inline-block font-bold animate-bounce"
            style={{ animationDelay: "100ms" }}
          >
            .
          </span>
        </div>
      </div>

      <form onSubmit={sendMsg} className="w-full flex flex-row">
        <input
          value={msgInput}
          onChange={(e) => setMsgInput(e.currentTarget.value)}
          className="w-full outline-none border-2 px-4 py-2 rounded"
          type="text"
          placeholder="Enter your message"
          required
          disabled={processingMsg}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
          disabled={processingMsg}
        >
          Send
        </button>
      </form>
    </main>
  );
};

export default App;
