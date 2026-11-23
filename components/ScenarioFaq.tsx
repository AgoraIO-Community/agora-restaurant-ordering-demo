'use client';

import { ChevronDown } from 'lucide-react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const questions = [
  {
    "question": "How long does a session last?",
    "answer": "Each session ends after 10 minutes. Start a new session to continue."
  },
  {
    "question": "How do I start?",
    "answer": "Choose Talk to the order desk and allow microphone access. Speak in English."
  },
  {
    "question": "What should I say?",
    "answer": "I would like two Garden Pizzas for delivery."
  },
  {
    "question": "Can I correct a detail?",
    "answer": "Yes. For example, say: Change that to one Garden Pizza and make it pickup. The assistant will update the spoken draft."
  },
  {
    "question": "What happens to my request?",
    "answer": "This is a fictional exercise. The assistant gives a verbal recap for this conversation."
  }
];

export function ScenarioFaq() {
  return (
    <DialogContent className="demo-inspector demo-faq-drawer">
      <DialogHeader className="demo-faq-heading">
        <DialogTitle>Frequently asked questions</DialogTitle>
        <DialogDescription>How to get started, what to ask, and what to expect.</DialogDescription>
      </DialogHeader>
      <div className="demo-faq-list">
        {questions.map(({ question, answer }) => (
          <details className="demo-faq-item" key={question}>
            <summary>
              <span>{question}</span>
              <ChevronDown className="demo-faq-chevron" size={16} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </DialogContent>
  );
}
