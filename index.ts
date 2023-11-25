import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import OpenAI from "openai";
import { removeStopwords } from "stopword";

import { generatePrompt } from "./utils";

//For env File
dotenv.config();

type Quiz = {
  question: string;
  options: string[];
  answer: string;
};

type TokenizationResult = {
  ok: boolean;
  sentences: Sentence[];
};

type Sentence = {
  sentence: string;
  words: Word[];
};

type Word = {
  word: string;
  isStopWord: boolean;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app: Application = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.get("/", (req: Request, res: Response) => {
  res.send("We are Five Guys");
});

app.post(
  "/image-to-text",
  body("encodedImage").isBase64().notEmpty(),
  (req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    //@ts-ignore
    const segmenter = new Intl.Segmenter("en", { granularity: "word" });

    const dummyDialog =
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";

    const dialogSentences = dummyDialog
      .split(".")
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    const result: TokenizationResult = {
      ok: true,
      sentences: dialogSentences.map((sentence) => {
        const segmentedText = segmenter.segment(sentence);

        const words = [...segmentedText]
          .filter((s) => s.isWordLike)
          .map((word: any) => {
            return {
              word: word.segment,
              isStopWord: removeStopwords([word.segment]).length === 0,
            };
          });
        return {
          sentence,
          words,
        };
      }),
    };

    res.json(result);
  }
);

app.post(
  "/make-quiz",
  body("sentence").isString(),
  body("word").isString(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ errors: errors.array(), message: "Invalid Request" });
    }
    const { sentence, word } = req.body;
    // How to handle long task?
    const prompt = generatePrompt(sentence, word);

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-1106-preview",
    });

    if (chatCompletion.choices.length > 0) {
      const quiz: Quiz = JSON.parse(
        `${chatCompletion.choices[0].message.content!}`
      );

      res.json(quiz);
    } else {
      res.status(500).json({ message: "OpenAI API No Response" });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
