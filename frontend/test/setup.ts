import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Provide a proper localStorage implementation for test environment
// vitest v4 + jsdom sometimes provides a non-functional localStorage
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, value: string): void => {
    store[key] = String(value);
  },
  removeItem: (key: string): void => {
    delete store[key];
  },
  clear: (): void => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  get length(): number {
    return Object.keys(store).length;
  },
  key: (index: number): string | null => {
    return Object.keys(store)[index] ?? null;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

afterEach(() => {
  cleanup();
  localStorageMock.clear();
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// Mock scrollTo
Element.prototype.scrollTo = vi.fn() as any;
