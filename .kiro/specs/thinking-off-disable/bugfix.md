# Bugfix Requirements Document

## Introduction

When the thinking level is set to 'off', the custom provider should not send any thinking-related parameters to the backend API. Currently, `mapThinkingLevelCustom` in 'auto' and 'chat-template-kwargs' modes still sends `chat_template_kwargs: { enable_thinking: false }` when the level is 'off'. This causes some backends (e.g. Qwen via llama.cpp) to still produce thinking/reasoning content in their response, because the server interprets the presence of `chat_template_kwargs` as a signal to engage its thinking template — regardless of the boolean value inside.

The correct behavior for 'off' is to omit all thinking-related fields from the request body entirely, matching how the OpenAI mapper handles 'off' (returns `{}`).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN thinkingLevel is 'off' AND reasoningMode is 'auto' THEN the system sends `chat_template_kwargs: { enable_thinking: false }` in the request body to the backend API

1.2 WHEN thinkingLevel is 'off' AND reasoningMode is 'chat-template-kwargs' THEN the system sends `chat_template_kwargs: { enable_thinking: false }` in the request body to the backend API

1.3 WHEN thinkingLevel is 'off' AND reasoningMode is 'auto' AND custom thinkingKwargs contains all-boolean values THEN the system sends `chat_template_kwargs` with negated boolean values in the request body

### Expected Behavior (Correct)

2.1 WHEN thinkingLevel is 'off' AND reasoningMode is 'auto' THEN the system SHALL NOT include any thinking-related parameters (`reasoning_effort`, `chat_template_kwargs`) in the request body

2.2 WHEN thinkingLevel is 'off' AND reasoningMode is 'chat-template-kwargs' THEN the system SHALL NOT include `chat_template_kwargs` in the request body

2.3 WHEN thinkingLevel is 'off' AND reasoningMode is 'auto' AND custom thinkingKwargs are configured THEN the system SHALL NOT include any thinking-related parameters in the request body

### Unchanged Behavior (Regression Prevention)

3.1 WHEN thinkingLevel is not 'off' AND reasoningMode is 'auto' THEN the system SHALL CONTINUE TO send both `reasoning_effort` and `chat_template_kwargs` in the request body

3.2 WHEN thinkingLevel is not 'off' AND reasoningMode is 'chat-template-kwargs' THEN the system SHALL CONTINUE TO send `chat_template_kwargs` with the appropriate thinking parameters

3.3 WHEN thinkingLevel is not 'off' AND reasoningMode is 'openai-reasoning-effort' THEN the system SHALL CONTINUE TO send only `reasoning_effort` in the request body

3.4 WHEN thinkingLevel is 'off' AND reasoningMode is 'none' THEN the system SHALL CONTINUE TO return an empty object (no parameters sent)

3.5 WHEN thinkingLevel is 'off' AND reasoningMode is 'openai-reasoning-effort' THEN the system SHALL CONTINUE TO return an empty object (no parameters sent)
