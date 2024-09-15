export type ModelEventType =
  | { type: 'llm_start'; data: LLMStartEvent }
  | { type: 'llm_content'; data: LLMContentEvent }
  | { type: 'llm_stop'; data: LLMFinishEvent }
  | { type: 'tool_start'; data: ToolStartEvent }
  | { type: 'tool_result'; data: ToolResultEvent }
  | { type: 'model_error'; data: string }
  | { type: 'unknown_error'; data: string };

export interface ModelEvent {
  span_id: string;
  trace_id: string;
  event: ModelEventType;
  timestamp: string;
}

export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMContentEvent {
  content: string;
}

export interface LLMStartEvent {
  provider_name: string;
  model_name: string;
  input: string;
}

export interface LLMFinishEvent {
  provider_name: string;
  model_name: string;
  output?: string;
  usage?: ModelUsage;
  finish_reason: ModelFinishReason;
  tool_calls: ModelToolCall[];
}

export interface ModelToolCall {
  tool_id: string;
  tool_name: string;
  input: string;
}

export enum ModelFinishReason {
  Stop = 'stop',
  StopSequence = 'stop_sequence',
  Length = 'length',
  ToolCalls = 'tool_calls',
  ContentFilter = 'content_filter',
  Guardrail = 'guardrail',
  Other = 'other'
}

export interface ToolStartEvent {
  tool_id: string;
  tool_name: string;
  input: string;
}

export interface ToolResultEvent {
  tool_id: string;
  tool_name: string;
  is_error: boolean;
  output: string;
}

export interface ModelToolResult {
  tool_id: string;
  tool_name: string;
  output: string;
  is_error: boolean;
}
