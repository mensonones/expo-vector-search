# Changelog

## [0.3.0] - 2026-01-31

### Adicionado
- **CRUD completo**: Suporte para `remove(key)` e `update(key, vector)` no motor nativo.
- **Hook `useVectorSearch`**: Nova abstração em React para gerenciamento automático de índice e memória.
- **Filtragem Nativa**: Suporte para `allowedKeys` no método `search`, permitindo filtrar resultados diretamente no C++.
- **Métrica Jaccard customizada**: Implementação otimizada para vetores `f32` (útil para busca de habilidades/conjuntos esparsos).

### Corrigido
- **Android Freeze**: Corrigido bug de inicialização no USearch que causava congelamento do aplicativo ao usar métricas customizadas.
- **iOS Memory Garbage**: Resolvido problema de resultados imprecisos (100% de match errada) devido a lixo de memória na inicialização de dimensões.
- **Demos Determinísticos**: Geração de dados nos demos de "Skills" e "Colors" agora usa uma semente fixa, garantindo resultados idênticos em Android e iOS.

### Alterado
- Melhoria no log nativo para facilitar depuração de erros de alinhamento de memória.
- Instruções do demo de Jaccard revertidas para Inglês.

---
[0.3.0]: https://github.com/mensonones/expo-vector-search/milestone/1
