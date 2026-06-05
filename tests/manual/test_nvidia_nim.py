# -*- coding: utf-8 -*-
"""Test de la gateway avec NVIDIA NIM"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'QGISIA2'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'QGISIA2', 'vendor'))

# Test du build kwargs
from llm_gateway import _build_completion_kwargs, _extract_provider

print('=== Test _extract_provider ===')
test_models = [
    'nvidia_nim/nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia_nim/meta/llama-3.1-70b-instruct',
    'openrouter/anthropic/claude-3.5-sonnet',
    'groq/llama-3.3-70b-versatile',
]
for m in test_models:
    print(f'  {m} -> provider: {_extract_provider(m)}')

print('\n=== Test _build_completion_kwargs ===')
kwargs = _build_completion_kwargs(
    model='nvidia_nim/nvidia/llama-3.1-nemotron-70b-instruct',
    messages=[{'role': 'user', 'content': 'Hello'}],
    api_keys={'nvidia_nim': 'test-key-123'},
    stream=False,
    temperature=0.2,
    max_tokens=100,
    tools=None
)
print(f'  Model: {kwargs.get("model")}')
print(f'  api_base: {kwargs.get("api_base")}')
print(f'  api_key: {kwargs.get("api_key")}')

print('\n=== Test cas sans api_base (ollama) ===')
kwargs_ollama = _build_completion_kwargs(
    model='ollama/llama3.2',
    messages=[{'role': 'user', 'content': 'Hello'}],
    api_keys={'ollama_base_url': 'http://localhost:11434'},
    stream=False,
    temperature=0.7,
    max_tokens=None,
    tools=None
)
print(f'  Model: {kwargs_ollama.get("model")}')
print(f'  api_base: {kwargs_ollama.get("api_base")}')

print('\n=== Test cas sans provider connu ===')
kwargs_other = _build_completion_kwargs(
    model='openrouter/anthropic/claude-3.5-sonnet',
    messages=[{'role': 'user', 'content': 'Hello'}],
    api_keys={'openrouter': 'test-key-456'},
    stream=False,
    temperature=0.3,
    max_tokens=None,
    tools=None
)
print(f'  Model: {kwargs_other.get("model")}')
print(f'  api_base: {kwargs_other.get("api_base")}')
print(f'  api_key: {kwargs_other.get("api_key")}')

print('\n=== Succès ===')
