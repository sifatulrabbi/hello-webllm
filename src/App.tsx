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
import { FaInfoCircle, FaRobot } from "react-icons/fa";

type Message = {
  id: string;
  role: "assistant" | "user" | "system" | "tool";
  content: string;
  sentAt: string;
};

const modelId = "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC";
const loadEngineProgressKey = "hello-webllm.locals.loading-engine";
const messagesRepoKey = "hello-webllm.locals.messages-repo";
const modelInfo =
  webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === modelId) ||
  null;

// console.log(
//   webllm.prebuiltAppConfig.model_list.map(
//     (m) => `[${m.vram_required_MB}] ${m.model_id}`,
//   ),
// );

sessionStorage.removeItem(loadEngineProgressKey);

const App: FC = () => {
  const [engine, setEngine] = useState<webllm.MLCEngine | null>(null);
  const [engineLoadingProgress, setEngineLoadingProgress] = useState("");
  const [msgInput, setMsgInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [processingMsg, setProcessingMsg] = useState(false);
  const messagesContainer = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   prepareEngine();
  // }, []);

  useEffect(() => {
    if (messages.length < 1) return;
    localStorage.setItem(messagesRepoKey, JSON.stringify(messages));
  }, [messages]);

  async function prepareEngine() {
    const loadingStatus = sessionStorage.getItem(loadEngineProgressKey);

    if (loadingStatus === "true") return;

    sessionStorage.setItem(loadEngineProgressKey, "true");
    try {
      const e = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          setEngineLoadingProgress(`${report.text}`);
          // console.log(report);
        },
      });
      setEngine(e);
      setEngineLoadingProgress("");
    } catch (err) {
      console.error("unable to fully load the model:", err);
    } finally {
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
    }
  }

  async function clearStorage() {
    await webllm.deleteModelAllInfoInCache(modelId);
    localStorage.removeItem(messagesRepoKey);
    sessionStorage.removeItem(loadEngineProgressKey);
    setEngineLoadingProgress("");
    setMessages([]);
    setProcessingMsg(false);
    setMsgInput("");
    setEngine(null);
  }

  async function processMsg(msgList: Message[]) {
    if (!engine) return;
    setProcessingMsg(true);
    scrollDown();
    try {
      const prompt: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful AI assistant." },
        // @ts-expect-error invalid ts type complexity
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
        <h3 className="font-bold text-xl">
          {engineLoadingProgress ? "Downloading model" : "Prepare the model"}
        </h3>
        {engineLoadingProgress ? (
          <>
            <p className="w-full bg-slate-200 text-slate-700 text-sm p-4 rounded font-mono">
              Need to download around: {modelInfo?.vram_required_MB || "--"}MB
              <br />
              {engineLoadingProgress}
            </p>
            <span className="font-bold animate-pulse">Please wait...</span>
          </>
        ) : (
          <>
            <p className="w-full bg-slate-200 text-slate-700 text-sm p-4 rounded font-mono">
              Download and prepare the model to get started.
            </p>
            <button
              onClick={prepareEngine}
              className="px-4 py-2 rounded bg-blue-400 text-white"
            >
              Start
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="w-full max-w-2xl mx-auto flex flex-col h-screen max-h-screen overflow-hidden text-slate-600">
      <div className="w-full flex justify-between items-center px-6 py-4 shadow">
        <h3 className="font-bold text-xl">Web LLM</h3>
        <div className="flex flex-row items-center justify-center gap-2">
          <div className="text-sm text-slate-400">
            {webllm.prebuiltAppConfig.model_list
              .find((m) => m.model_id === modelId)
              ?.vram_required_MB?.toString() + "MB" || "not sure"}
          </div>
          <button
            onClick={clearStorage}
            className="flex py-1 px-2 rounded bg-orange-400 text-white text-xs"
          >
            Delete data
          </button>
        </div>
      </div>

      <div
        ref={messagesContainer}
        className={`w-full flex flex-col items-start justify-start gap-y-4 h-full max-h-full overflow-y-auto px-6 py-4`}
      >
        <div className="flex flex-col gap-y-2 pb-4 border-b border-slate-100">
          <div className="rounded p-4 bg-blue-50 w-full text-sm text-slate-400">
            <div className="content-display">
              <FaInfoCircle className="inline text-blue-400 mr-1 w-4 h-4" />
              WebLLM downloads a compressed version of the chosen LLM model and
              saves it on your browser so that you can use the LLM quickly and
              even when offline. Learn more about them from the{" "}
              <a
                href="https://github.com/mlc-ai/web-llm?tab=readme-ov-file#webllm"
                className="underline text-blue-400"
              >
                official documentation
              </a>
            </div>
          </div>
          <div className="rounded p-4 bg-blue-50 w-full text-sm text-slate-400">
            <div className="content-display">
              <FaRobot className="inline text-blue-400 mr-1 w-4 h-4" />
              <strong>The model </strong>
              {modelInfo?.model_id && (
                <a
                  href={modelInfo?.model}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {modelInfo?.model_id}
                </a>
              )}
              {modelInfo?.model_type && (
                <>
                  <br />
                  {modelInfo.model_type}
                </>
              )}
            </div>
          </div>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[90%] rounded p-4 pt-2 ${msg.role === "assistant" ? "bg-slate-100" : "bg-blue-500 text-white self-end"}`}
          >
            {msg.role === "assistant" && (
              <FaRobot className="inline text-blue-400" />
            )}
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

      <form
        onSubmit={sendMsg}
        className="w-full flex flex-row px-6 py-4 border-t border-slate-100"
      >
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
