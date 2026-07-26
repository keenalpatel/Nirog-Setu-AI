"use client";

import React from "react";

// Replace with your real WhatsApp number: country code + number, no + or spaces
const WHATSAPP_NUMBER = "919441258168"; // dummy India number
const DEFAULT_MESSAGE = "Hello";

interface WhatsAppButtonProps {
  number?: string;
  message?: string;
  position?: "bottom-right" | "top-right";
}

export default function WhatsAppButton({
  number = WHATSAPP_NUMBER,
  message = DEFAULT_MESSAGE,
  position = "bottom-right",
}: WhatsAppButtonProps) {
  const link = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  const positionClasses =
    position === "top-right" ? "top-24 right-6" : "bottom-6 right-6";

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`fixed ${positionClasses} z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 shadow-lg shadow-green-900/40 transition-transform duration-200 hover:scale-110`}
    >
      <svg
        viewBox="0 0 32 32"
        className="w-7 h-7 fill-white"
        aria-hidden="true"
      >
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.34.653 4.526 1.786 6.393L4 29l7.809-1.744A11.93 11.93 0 0 0 16.001 27C22.628 27 28 21.627 28 15S22.628 3 16.001 3zm0 21.6a9.55 9.55 0 0 1-4.87-1.334l-.35-.207-4.63 1.034 1.04-4.51-.228-.365A9.56 9.56 0 0 1 6.4 15c0-5.302 4.298-9.6 9.601-9.6 5.302 0 9.6 4.298 9.6 9.6 0 5.303-4.298 9.6-9.6 9.6zm5.29-7.19c-.29-.145-1.716-.847-1.982-.944-.266-.097-.46-.145-.653.145-.194.29-.75.944-.92 1.138-.169.194-.338.218-.628.073-.29-.146-1.223-.451-2.33-1.437-.862-.768-1.444-1.716-1.613-2.006-.169-.29-.018-.447.127-.591.13-.13.29-.338.435-.508.145-.169.194-.29.29-.483.097-.194.048-.363-.024-.508-.073-.145-.653-1.575-.895-2.157-.236-.567-.476-.49-.653-.5-.169-.008-.363-.01-.556-.01a1.07 1.07 0 0 0-.774.363c-.266.29-1.016.993-1.016 2.423s1.04 2.81 1.185 3.005c.145.194 2.048 3.128 4.963 4.386.694.3 1.235.48 1.657.614.696.221 1.33.19 1.83.115.558-.083 1.716-.702 1.958-1.38.242-.678.242-1.259.169-1.38-.073-.121-.266-.194-.556-.339z" />
      </svg>
    </a>
  );
}
