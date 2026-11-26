# Synapse: Ilhas do Saber

Crie um app de estudos chamado "Synapse", em português do Brasil, pensado primeiro para celular (mobile-first), mas que também funcione bem no computador.

# IDEIA DO APP
O aluno estuda de um jeito divertido, como num jogo de exploração. Cada matéria que ele estuda é uma ILHA num mapa de arquipélago. O mascote é o Kip, um axolote espacial fofo e simpático que acompanha o aluno.

# VISUAL
- Estilo: fofo, acolhedor e mágico. Fundo de oceano em tons de azul-escuro e roxo, com estrelinhas, como um oceano cósmico.
- Cores principais: azul-marinho, roxo, rosa-claro (a cor do Kip) e dourado para recompensas.
- Cantos bem arredondados, botões grandes, fontes amigáveis.
- O Kip é um axolote rosa com guelras que parecem pequenas estrelas. Por enquanto, use um emoji 🦎 ou um desenho simples em SVG no lugar dele.

# TELAS

## 1. Mapa do Arquipélago (tela inicial)
- Mostra várias ilhas espalhadas num oceano. Cada ilha é um círculo/forma orgânica colorida com um emoji no centro e o nome da matéria embaixo.
- Crie 4 ilhas de exemplo: Biologia 🌿, História 🏛️, Matemática 🔢, Inglês 💬.
- Cada ilha mostra uma barrinha de "saúde da memória".
- NÉVOA: se a memória da ilha está baixa, uma névoa cinza-azulada semitransparente cobre a ilha. Faça 4 níveis: sem névoa, névoa leve, névoa densa e sombra total. Nas ilhas de exemplo, deixe cada uma num nível diferente.
- Importante: a névoa NUNCA é punição. O tom é de resgate e carinho, nunca de bronca.
- Ao tocar numa ilha, abre a tela daquela ilha.
- Botão grande flutuante "+ Nova ilha".
- No topo: um balão de fala do Kip com uma frase carinhosa, por exemplo "A névoa chegou em Biologia! Bora resgatar? 🌫️"

## 2. Tela da Ilha
- Nome da ilha, o Kip e o nível de névoa.
- Botão principal e bem destacado: "Resgatar a ilha" (ou "Estudar hoje" se não tiver névoa).
- Abaixo, os TÓPICOS da matéria numa lista que expande e recolhe, como árvore. Use dados de exemplo (para Biologia: Célula > Mitocôndria, Núcleo, Membrana).
- Cada tópico mostra um selinho: "novo", "em dia" ou "precisa de revisão".

## 3. Tela de Revisão (as cartas)
- Mostra UMA carta por vez, grande, no centro da tela.
- A carta tem uma frase com uma lacuna, por exemplo: "A ______ é a organela que produz energia na célula."
- Botão "Mostrar resposta" que vira a carta com uma animação suave.
- Depois de ver a resposta, 3 botões: "Errei 😵", "Quase 🤔", "Acertei 🎉".
- Barra de progresso no topo (ex.: 3 de 10 cartas).
- No fim, uma tela de comemoração: o Kip pula de alegria, a névoa da ilha some com uma animação, e aparece "Ilha resgatada!".
- Use 5 cartas de exemplo de Biologia.

## 4. Tela "Nova Ilha"
- Campo para o nome da matéria.
- Uma caixa grande para colar o texto do material de estudo.
- Um botão "Enviar PDF" (por enquanto só visual, ainda sem funcionar).
- Botão "Criar minha ilha".
- Ao clicar, mostra uma animação de carregamento com o Kip e frases que mudam: "Lendo seu material...", "Construindo a ilha...", "Criando suas cartas...". Por enquanto, depois de 4 segundos, só mostra uma ilha nova de exemplo no mapa.

# NAVEGAÇÃO
Uma barra fixa embaixo com 3 botões: 🗺️ Mapa, 🃏 Revisar hoje, 👤 Perfil. A tela Perfil pode ser simples, só com o nome e uma sequência de dias estudados (ex.: "🔥 5 dias seguidos").

# REGRAS IMPORTANTES
- Todos os textos em português do Brasil, informais e carinhosos.
- Por enquanto, use apenas dados de exemplo. Ainda NÃO conecte banco de dados, login nem IA. Vamos fazer isso depois, em outra etapa.
- Priorize que fique bonito, fluido e fácil de usar com o dedão.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7b795ca0-4e28-47fa-b83c-bc6e253febf4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
