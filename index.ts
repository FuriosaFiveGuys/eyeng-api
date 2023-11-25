import cors from "cors";
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

app.use(cors());
app.use(express.json());
app.get("/", (req: Request, res: Response) => {
  res.send("We are Five Guys");
});

app.post(
  "/image-to-text",
  body("imageUrl").isString().notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const imageUrl = req.body.imageUrl;

    const ocrResult = await fetch("http://14.35.173.13:20367/image-to-text", {
      method: "POST",
      body: JSON.stringify({
        imageUrl,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = (await ocrResult.json()) as {
      sentences: string;
    };

    //@ts-ignore
    const segmenter = new Intl.Segmenter("en", { granularity: "word" });

    const dialogSentences = data.sentences
      .replace(/"/g, "")
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
