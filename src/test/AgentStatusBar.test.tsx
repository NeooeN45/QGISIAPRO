/**
 * Tests pour AgentStatusBar.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import React from "react";

import AgentStatusBar from "../components/AgentStatusBar";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetBudget = vi.fn();

vi.mock("../hooks/useLLMGateway", () => ({
  useLLMGateway: vi.fn(() => ({
    status: "ready",
    ready: true,
    lastError: undefined,
    defaultAlias: "smart-default",
    getBudget: mockGetBudget,
  })),
}));

import { useLLMGateway } from "../hooks/useLLMGateway";

let mockStore = {
  config: {
    defaultAlias: "smart-default",
    useGateway: true,
    federationMode: false,
    agentMode: false,
    status: "ready" as const,
  },
};

vi.mock("../stores/useGatewayStore", () => ({
  useGatewayStore: vi.fn((selector: any) => selector(mockStore)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBudget(overrides: any = {}) {
  return {
    day: "2026-06-12",
    total_usd: 0,
    by_model: {},
    request_count: 0,
    limits: { daily_max_usd: 10, warn_at_percent: 80 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("AgentStatusBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetBudget.mockReset();
    mockGetBudget.mockResolvedValue(makeBudget());
    vi.mocked(useLLMGateway).mockReturnValue({
      status: "ready",
      ready: true,
      lastError: undefined,
      defaultAlias: "smart-default",
      getBudget: mockGetBudget,
    } as any);
    mockStore = {
      config: {
        defaultAlias: "smart-default",
        useGateway: true,
        federationMode: false,
        agentMode: false,
        status: "ready",
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushPromises() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("affiche le mode Gateway par defaut", () => {
    render(<AgentStatusBar />);
    expect(screen.getByText("Gateway")).toBeTruthy();
  });

  it("affiche le mode SIG Intelligent quand federationMode", () => {
    mockStore.config.federationMode = true;
    render(<AgentStatusBar />);
    expect(screen.getByText("SIG Intelligent")).toBeTruthy();
  });

  it("affiche le mode Action quand agentMode", () => {
    mockStore.config.agentMode = true;
    render(<AgentStatusBar />);
    expect(screen.getByText("Mode Action")).toBeTruthy();
  });

  it("barre verte quand budget < warn_at_percent", () => {
    render(<AgentStatusBar />);
    const bar = screen.getByTestId("budget-bar");
    expect(bar.className).toContain("bg-emerald-500");
  });

  it("barre orange quand budget >= warn_at_percent", async () => {
    mockGetBudget.mockResolvedValue(makeBudget({ total_usd: 8.5 }));
    render(<AgentStatusBar />);
    await flushPromises();
    await waitFor(() => {
      const bar = screen.getByTestId("budget-bar");
      expect(bar.className).toContain("bg-orange-500");
    });
  });

  it("barre rouge quand budget >= 100%", async () => {
    mockGetBudget.mockResolvedValue(makeBudget({ total_usd: 10 }));
    render(<AgentStatusBar />);
    await flushPromises();
    await waitFor(() => {
      const bar = screen.getByTestId("budget-bar");
      expect(bar.className).toContain("bg-red-500");
    });
  });

  it("affiche le statut error avec tooltip lastError", async () => {
    vi.mocked(useLLMGateway).mockReturnValue({
      status: "error" as const,
      ready: true,
      lastError: "Connection refused",
      defaultAlias: "smart-default",
      getBudget: mockGetBudget,
    } as any);
    render(<AgentStatusBar />);
    const dot = screen.getByTestId("status-dot");
    expect(dot.getAttribute("title")).toBe("Connection refused");
    expect(dot.textContent).toContain("error");
  });

  it("ne fait pas de fetch si !ready", () => {
    vi.mocked(useLLMGateway).mockReturnValue({
      status: "installing" as const,
      ready: false,
      lastError: undefined,
      defaultAlias: "smart-default",
      getBudget: mockGetBudget,
    } as any);
    render(<AgentStatusBar />);
    expect(mockGetBudget).not.toHaveBeenCalled();
  });

  it("nettoie l'interval au demontage", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(<AgentStatusBar />);
    expect(setIntervalSpy).toHaveBeenCalled();
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("poll toutes les 60s quand ready", async () => {
    render(<AgentStatusBar />);
    await flushPromises();
    expect(mockGetBudget).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushPromises();
    expect(mockGetBudget).toHaveBeenCalledTimes(2);
  });

  it("utilise budgetFetcher injecte en prop", async () => {
    const customFetcher = vi.fn().mockResolvedValue(makeBudget({ total_usd: 5 }));
    render(<AgentStatusBar budgetFetcher={customFetcher} />);
    await flushPromises();
    expect(customFetcher).toHaveBeenCalled();
    expect(mockGetBudget).not.toHaveBeenCalled();
  });
});
