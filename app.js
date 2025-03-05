const { useState, useEffect, useRef, useMemo } = React;
const { createRoot } = ReactDOM;

// Constants
const SNAKE_COLORS = [
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#ff9f43', // Orange
  '#a29bfe', // Purple
  '#55efc4', // Mint
  '#ffeaa7', // Yellow
  '#74b9ff', // Blue
  '#fab1a0', // Peach
  '#81ecec', // Cyan
  '#dfe6e9'  // White
];

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState('gallery');
  const [generating, setGenerating] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [worldToView, setWorldToView] = useState(null);
  const room = useMemo(() => new WebsimSocket(), []);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'play') {
      setIsPlaying(false);
      setSelectedWorld(null);
    }
  };
  
  const handlePlay = (world) => {
    setSelectedWorld(world);
    setActiveTab('play');
    setIsPlaying(true);
  };
  
  const handleViewWorld = (world) => {
    setWorldToView(world);
  };
  
  const closeModal = () => {
    setWorldToView(null);
  };
  
  return (
    <div className="app-container">
      <header>
        <h1>This Snake Game Does Not Exist</h1>
        <h2>AI-Generated Snake Worlds</h2>
      </header>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'gallery' ? 'active' : ''}`} 
          onClick={() => handleTabChange('gallery')}
        >
          Gallery
        </button>
        <button 
          className={`tab ${activeTab === 'create' ? 'active' : ''}`} 
          onClick={() => handleTabChange('create')}
        >
          Create
        </button>
        <button 
          className={`tab ${activeTab === 'play' ? 'active' : ''}`} 
          onClick={() => handleTabChange('play')}
          disabled={!selectedWorld}
        >
          Play
        </button>
      </div>
      
      {activeTab === 'gallery' && (
        <WorldGallery 
          room={room}
          onPlay={handlePlay} 
          onView={handleViewWorld}
        />
      )}
      
      {activeTab === 'create' && (
        <WorldGenerator 
          room={room}
          generating={generating}
          setGenerating={setGenerating}
          onCreated={(world) => {
            setActiveTab('gallery');
          }}
        />
      )}
      
      {activeTab === 'play' && selectedWorld && (
        <GameBoard 
          room={room}
          world={selectedWorld}
          isPlaying={isPlaying}
          onExit={() => setActiveTab('gallery')}
        />
      )}
      
      {worldToView && (
        <WorldModal world={worldToView} onClose={closeModal} />
      )}
    </div>
  );
}

// World Generator Component
function WorldGenerator({ room, generating, setGenerating, onCreated }) {
  const [theme, setTheme] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [powerups, setPowerups] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!theme) {
      setError('Please provide a theme for your snake world');
      return;
    }
    
    setError('');
    setGenerating(true);
    
    try {
      // Generate world description with the LLM
      const worldPrompt = `Create a detailed and creative description for a snake game world with the following parameters:
      Theme: ${theme}
      Obstacles: ${obstacles || 'standard'}
      Power-ups: ${powerups || 'standard'}
      
      The description should be imaginative, detailed, and suitable for a snake game. Include details about the visual environment, obstacles, and special features.
      Format the response as a JSON object with the following fields:
      {
        "title": "A catchy title for this snake world",
        "description": "A detailed paragraph describing the world, its theme, and unique features",
        "layoutDescription": "Technical details about the layout that will be used to generate the game map"
      }`;
      
      const worldCompletion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a creative game designer specializing in unique and imaginative snake game worlds."
          },
          {
            role: "user",
            content: worldPrompt
          }
        ],
        json: true
      });
      
      const worldData = JSON.parse(worldCompletion.content);
      
      // Generate an image based on the world description
      const imagePrompt = `Create a top-down view of a snake game map with the following theme: ${worldData.description}. The image should be suitable as a background for a snake game, with clear areas where a snake could navigate. Include the described obstacles and environment, but keep the overall design clean enough for gameplay.`;
      
      const imageResult = await websim.imageGen({
        prompt: imagePrompt,
        aspect_ratio: "1:1"
      });
      
      // Save the world to the database
      const createdRecord = await room.collection('snakeWorld').create({
        title: worldData.title,
        description: worldData.description,
        layoutDescription: worldData.layoutDescription,
        imageUrl: imageResult.url,
        theme: theme,
        obstacles: obstacles,
        powerups: powerups
      });
      
      onCreated(createdRecord);
    } catch (error) {
      console.error('Error generating world:', error);
      setError('Failed to generate world. Please try again.');
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <div>
      <h2>Create a New Snake World</h2>
      <form className="generator-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="theme">Theme (required)</label>
          <input
            type="text"
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g., Cyberpunk city, Underwater reef, Haunted mansion"
            disabled={generating}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="obstacles">Obstacles (optional)</label>
          <input
            type="text"
            id="obstacles"
            value={obstacles}
            onChange={(e) => setObstacles(e.target.value)}
            placeholder="e.g., Laser barriers, Moving walls, Quicksand pits"
            disabled={generating}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="powerups">Power-ups (optional)</label>
          <input
            type="text"
            id="powerups"
            value={powerups}
            onChange={(e) => setPowerups(e.target.value)}
            placeholder="e.g., Speed boost, Shield, Teleportation"
            disabled={generating}
          />
        </div>
        
        {error && <p className="error">{error}</p>}
        
        <button 
          type="submit" 
          className="button" 
          disabled={generating || !theme}
        >
          {generating ? 'Generating...' : 'Generate Snake World'}
        </button>
      </form>
    </div>
  );
}

// World Gallery Component
function WorldGallery({ room, onPlay, onView }) {
  const worlds = React.useSyncExternalStore(
    room.collection('snakeWorld').subscribe,
    room.collection('snakeWorld').getList
  );
  
  if (!worlds || worlds.length === 0) {
    return (
      <div className="loading">
        <p>No snake worlds found. Create one to get started!</p>
      </div>
    );
  }
  
  // Sort worlds by newest first
  const sortedWorlds = [...worlds].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  return (
    <div>
      <h2>Snake World Gallery</h2>
      <div className="gallery">
        {sortedWorlds.map(world => (
          <div className="snake-world-card" key={world.id}>
            <img
              src={world.imageUrl}
              alt={world.title}
              className="world-image"
            />
            <div className="world-details">
              <h3 className="world-title">{world.title}</h3>
              <p className="world-author">Created by: {world.username}</p>
              <p className="world-description">{world.description}</p>
              <div>
                <button className="button view-button" onClick={() => onView(world)}>
                  View Details
                </button>
                <button className="button play-button" onClick={() => onPlay(world)}>
                  Play
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// World Modal Component
function WorldModal({ world, onClose }) {
  if (!world) return null;
  
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h2>{world.title}</h2>
        <img src={world.imageUrl} alt={world.title} className="modal-image" />
        <p><strong>Created by:</strong> {world.username}</p>
        <p><strong>Created on:</strong> {new Date(world.created_at).toLocaleString()}</p>
        <p><strong>Theme:</strong> {world.theme}</p>
        {world.obstacles && <p><strong>Obstacles:</strong> {world.obstacles}</p>}
        {world.powerups && <p><strong>Power-ups:</strong> {world.powerups}</p>}
        <h3>Description:</h3>
        <p>{world.description}</p>
      </div>
    </div>
  );
}

// Game Board Component
function GameBoard({ room, world, isPlaying, onExit }) {
  const canvasRef = useRef(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameStateRef = useRef(null);
  const requestRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const [mapLayout, setMapLayout] = useState(null);
  const [loadingMap, setLoadingMap] = useState(true);
  
  // Get connected players
  const players = React.useSyncExternalStore(
    room.party.subscribe,
    () => room.party.peers
  );
  
  // Generate map layout when component mounts
  useEffect(() => {
    const generateMapLayout = async () => {
      try {
        setLoadingMap(true);
        
        const layoutPrompt = `
        Create a game map layout for a snake game based on this description: "${world.layoutDescription}".
        
        The map should be a 20x20 grid where:
        - 0 represents an empty space where the snake can move
        - 1 represents a wall or obstacle the snake cannot pass through
        - 2 represents a special area (like a power-up spawn point)
        
        Return ONLY a 20x20 grid as a JSON array of arrays, with no additional text.
        For example:
        [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          ...
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ]
        
        Ensure there are plenty of open spaces for snakes to move around, and the obstacles create interesting pathways.
        Don't completely section off areas - make sure all empty spaces are accessible.`;
        
        const layoutCompletion = await websim.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a game level designer specializing in snake game layouts."
            },
            {
              role: "user",
              content: layoutPrompt
            }
          ],
          json: true
        });
        
        const mapData = JSON.parse(layoutCompletion.content);
        setMapLayout(mapData);
      } catch (error) {
        console.error('Error generating map layout:', error);
        // Fall back to a simple map with a border
        const fallbackMap = Array(20).fill().map((_, rowIndex) => 
          Array(20).fill().map((_, colIndex) => 
            rowIndex === 0 || colIndex === 0 || rowIndex === 19 || colIndex === 19 ? 1 : 0
          )
        );
        setMapLayout(fallbackMap);
      } finally {
        setLoadingMap(false);
      }
    };
    
    generateMapLayout();
    
    // Set up event listeners for multiplayer
    room.onmessage = (event) => {
      const data = event.data;
      
      if (data.type === 'snakeUpdate' && gameStateRef.current) {
        const { clientId, snake, score } = data;
        
        // Don't update our own snake - we handle that locally
        if (clientId !== room.party.client.id) {
          const otherPlayerIndex = gameStateRef.current.otherPlayers.findIndex(
            p => p.id === clientId
          );
          
          if (otherPlayerIndex >= 0) {
            gameStateRef.current.otherPlayers[otherPlayerIndex].snake = snake;
            gameStateRef.current.otherPlayers[otherPlayerIndex].score = score;
          } else {
            // New player joined
            const colorIndex = gameStateRef.current.otherPlayers.length % SNAKE_COLORS.length;
            gameStateRef.current.otherPlayers.push({
              id: clientId,
              username: data.username,
              snake: snake,
              score: score,
              color: SNAKE_COLORS[colorIndex + 1] // Start from second color (first is player)
            });
          }
        }
      }
      
      if (data.type === 'foodUpdate' && gameStateRef.current) {
        gameStateRef.current.food = data.food;
      }
      
      if (data.type === 'playerLeft' && gameStateRef.current) {
        gameStateRef.current.otherPlayers = gameStateRef.current.otherPlayers.filter(
          p => p.id !== data.clientId
        );
      }
    };
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      // Notify other players that we're leaving
      if (gameStateRef.current) {
        room.send({
          type: 'playerLeft',
          clientId: room.party.client.id
        });
      }
    };
  }, [room, world]);
  
  const startGame = () => {
    if (!canvasRef.current || !mapLayout || loadingMap) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const gridSize = 20;
    const cellSize = canvas.width / gridSize;
    
    // Initialize game state
    gameStateRef.current = {
      snake: [{ x: 10, y: 10 }], // Starting position
      direction: { x: 1, y: 0 }, // Starting direction: right
      nextDirection: { x: 1, y: 0 },
      food: { x: 15, y: 10 },
      score: 0,
      speed: 150, // ms per update
      otherPlayers: [],
      gameOver: false,
      map: mapLayout
    };
    
    // Set initial state
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    
    // Place food randomly
    placeFood();
    
    // Broadcast our initial snake position
    broadcastSnakeUpdate();
    
    // Start game loop
    lastUpdateTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
    
    // Function to place food in random, valid location
    function placeFood() {
      const state = gameStateRef.current;
      let newFood;
      let validPosition = false;
      
      while (!validPosition) {
        newFood = {
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize)
        };
        
        // Check if position is valid (not occupied by snake or wall)
        const notOnSnake = !state.snake.some(segment => 
          segment.x === newFood.x && segment.y === newFood.y
        );
        
        const notOnWall = state.map[newFood.y][newFood.x] === 0;
        
        const notOnOtherSnakes = !state.otherPlayers.some(player => 
          player.snake.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
          )
        );
        
        validPosition = notOnSnake && notOnWall && notOnOtherSnakes;
      }
      
      state.food = newFood;
      
      // Broadcast food position to other players
      room.send({
        type: 'foodUpdate',
        food: newFood
      });
    }
    
    // Function to broadcast our snake position
    function broadcastSnakeUpdate() {
      const state = gameStateRef.current;
      
      room.send({
        type: 'snakeUpdate',
        clientId: room.party.client.id,
        username: room.party.client.username,
        snake: state.snake,
        score: state.score
      });
    }
    
    // Function to update game state
    function update() {
      const state = gameStateRef.current;
      if (state.gameOver) return;
      
      // Update direction
      state.direction = state.nextDirection;
      
      // Calculate new head position
      const head = {...state.snake[0]};
      head.x += state.direction.x;
      head.y += state.direction.y;
      
      // Check for collisions with walls
      if (
        head.x < 0 || head.x >= gridSize || 
        head.y < 0 || head.y >= gridSize ||
        state.map[head.y][head.x] === 1
      ) {
        state.gameOver = true;
        setGameOver(true);
        return;
      }
      
      // Check for collisions with self
      if (state.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        state.gameOver = true;
        setGameOver(true);
        return;
      }
      
      // Check for collisions with other players
      if (state.otherPlayers.some(player => 
        player.snake.some(segment => segment.x === head.x && segment.y === head.y)
      )) {
        state.gameOver = true;
        setGameOver(true);
        return;
      }
      
      // Move snake
      state.snake.unshift(head);
      
      // Check if food is eaten
      if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 10;
        setScore(state.score);
        placeFood();
      } else {
        state.snake.pop();
      }
      
      // Broadcast updated snake
      broadcastSnakeUpdate();
    }
    
    // Game loop
    function gameLoop(timestamp) {
      const state = gameStateRef.current;
      const deltaTime = timestamp - lastUpdateTimeRef.current;
      
      if (deltaTime >= state.speed) {
        update();
        render();
        lastUpdateTimeRef.current = timestamp;
      }
      
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    
    // Render game
    function render() {
      const state = gameStateRef.current;
      
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw map
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (state.map[y][x] === 1) {
            // Draw wall
            ctx.fillStyle = '#555555';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          } else if (state.map[y][x] === 2) {
            // Draw special area
            ctx.fillStyle = '#553388';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
      
      // Draw food
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(
        state.food.x * cellSize + cellSize / 2,
        state.food.y * cellSize + cellSize / 2,
        cellSize / 2.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      
      // Draw other players' snakes
      state.otherPlayers.forEach(player => {
        drawSnake(player.snake, player.color);
      });
      
      // Draw player's snake
      drawSnake(state.snake, SNAKE_COLORS[0]);
      
      // Function to draw a snake
      function drawSnake(snake, color) {
        ctx.fillStyle = color;
        
        snake.forEach((segment, index) => {
          if (index === 0) {
            // Draw head
            ctx.fillRect(
              segment.x * cellSize + 1, 
              segment.y * cellSize + 1, 
              cellSize - 2, 
              cellSize - 2
            );
            
            // Draw eyes
            ctx.fillStyle = '#000000';
            const eyeSize = cellSize / 6;
            const eyeOffset = cellSize / 4;
            
            // Determine eye positions based on direction
            let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
            
            if (index < snake.length - 1) {
              const nextSegment = snake[1];
              const dx = segment.x - nextSegment.x;
              const dy = segment.y - nextSegment.y;
              
              if (dx === 1) { // Moving right
                leftEyeX = segment.x * cellSize + cellSize - eyeOffset;
                leftEyeY = segment.y * cellSize + eyeOffset;
                rightEyeX = segment.x * cellSize + cellSize - eyeOffset;
                rightEyeY = segment.y * cellSize + cellSize - eyeOffset;
              } else if (dx === -1) { // Moving left
                leftEyeX = segment.x * cellSize + eyeOffset;
                leftEyeY = segment.y * cellSize + eyeOffset;
                rightEyeX = segment.x * cellSize + eyeOffset;
                rightEyeY = segment.y * cellSize + cellSize - eyeOffset;
              } else if (dy === 1) { // Moving down
                leftEyeX = segment.x * cellSize + eyeOffset;
                leftEyeY = segment.y * cellSize + cellSize - eyeOffset;
                rightEyeX = segment.x * cellSize + cellSize - eyeOffset;
                rightEyeY = segment.y * cellSize + cellSize - eyeOffset;
              } else { // Moving up
                leftEyeX = segment.x * cellSize + eyeOffset;
                leftEyeY = segment.y * cellSize + eyeOffset;
                rightEyeX = segment.x * cellSize + cellSize - eyeOffset;
                rightEyeY = segment.y * cellSize + eyeOffset;
              }
            } else {
              // Default eye position if only one segment
              leftEyeX = segment.x * cellSize + eyeOffset;
              leftEyeY = segment.y * cellSize + eyeOffset;
              rightEyeX = segment.x * cellSize + cellSize - eyeOffset;
              rightEyeY = segment.y * cellSize + eyeOffset;
            }
            
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = color;
          } else {
            // Draw body segment with rounded corners
            ctx.beginPath();
            ctx.roundRect(
              segment.x * cellSize + 2, 
              segment.y * cellSize + 2, 
              cellSize - 4, 
              cellSize - 4,
              [cellSize / 4]
            );
            ctx.fill();
          }
        });
      }
      
      // Draw grid (subtle)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i <= gridSize; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }
    }
  };
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStateRef.current || gameStateRef.current.gameOver) return;
      
      // Prevent default behavior for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      
      const direction = gameStateRef.current.direction;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (direction.y !== 1) { // Not moving down
            gameStateRef.current.nextDirection = { x: 0, y: -1 };
          }
          break;
        case 'ArrowDown':
        case 's':
          if (direction.y !== -1) { // Not moving up
            gameStateRef.current.nextDirection = { x: 0, y: 1 };
          }
          break;
        case 'ArrowLeft':
        case 'a':
          if (direction.x !== 1) { // Not moving right
            gameStateRef.current.nextDirection = { x: -1, y: 0 };
          }
          break;
        case 'ArrowRight':
        case 'd':
          if (direction.x !== -1) { // Not moving left
            gameStateRef.current.nextDirection = { x: 1, y: 0 };
          }
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Handle mobile controls
  const handleMobileControl = (direction) => {
    if (!gameStateRef.current || gameStateRef.current.gameOver) return;
    
    const currentDirection = gameStateRef.current.direction;
    
    switch (direction) {
      case 'up':
        if (currentDirection.y !== 1) { // Not moving down
          gameStateRef.current.nextDirection = { x: 0, y: -1 };
        }
        break;
      case 'down':
        if (currentDirection.y !== -1) { // Not moving up
          gameStateRef.current.nextDirection = { x: 0, y: 1 };
        }
        break;
      case 'left':
        if (currentDirection.x !== 1) { // Not moving right
          gameStateRef.current.nextDirection = { x: -1, y: 0 };
        }
        break;
      case 'right':
        if (currentDirection.x !== -1) { // Not moving left
          gameStateRef.current.nextDirection = { x: 1, y: 0 };
        }
        break;
      default:
        break;
    }
  };
  
  // Resize canvas to maintain aspect ratio
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        
        canvas.width = size;
        canvas.height = size;
        
        // If game is running, force a re-render
        if (gameStateRef.current) {
          const ctx = canvas.getContext('2d');
          const gridSize = 20;
          const cellSize = canvas.width / gridSize;
          
          // Clear canvas
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Re-render if game state exists
          if (gameStateRef.current.map) {
            // We would need to call our render function here
            // This is a simplified placeholder
            for (let y = 0; y < gridSize; y++) {
              for (let x = 0; x < gridSize; x++) {
                if (gameStateRef.current.map[y][x] === 1) {
                  ctx.fillStyle = '#555555';
                  ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
              }
            }
          }
        }
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  return (
    <div>
      <h2>{world.title}</h2>
      <div className="game-info">
        <div>Score: {score}</div>
        <button className="button" onClick={onExit}>Exit Game</button>
      </div>
      
      <div className="game-container">
        <canvas ref={canvasRef} className="game-canvas"></canvas>
        
        {loadingMap && (
          <div className="game-overlay">
            <h3>Generating Game Map...</h3>
            <p>Creating a unique snake experience based on the world description.</p>
          </div>
        )}
        
        {!loadingMap && !gameStarted && (
          <div className="game-overlay">
            <h3>Welcome to {world.title}</h3>
            <p>{world.description}</p>
            <button className="button" onClick={startGame}>Start Game</button>
          </div>
        )}
        
        {gameOver && (
          <div className="game-overlay">
            <h3>Game Over</h3>
            <p>Your score: {score}</p>
            <button className="button" onClick={startGame}>Play Again</button>
          </div>
        )}
      </div>
      
      <div className="mobile-controls">
        <button className="mobile-control-btn up-btn" onTouchStart={() => handleMobileControl('up')}>↑</button>
        <button className="mobile-control-btn left-btn" onTouchStart={() => handleMobileControl('left')}>←</button>
        <button className="mobile-control-btn right-btn" onTouchStart={() => handleMobileControl('right')}>→</button>
        <button className="mobile-control-btn down-btn" onTouchStart={() => handleMobileControl('down')}>↓</button>
      </div>
      
      <div className="players-list">
        <h3>Connected Players</h3>
        {Object.keys(players).map((clientId, index) => {
          const player = players[clientId];
          const color = SNAKE_COLORS[index % SNAKE_COLORS.length];
          return (
            <div className="player-item" key={clientId}>
              <div className="player-color" style={{backgroundColor: color}}></div>
              <span>{player.username} {clientId === room.party.client.id ? '(You)' : ''}</span>
              {gameStateRef.current && gameStateRef.current.otherPlayers && 
               clientId !== room.party.client.id && 
               gameStateRef.current.otherPlayers.find(p => p.id === clientId) && (
                <span> - Score: {gameStateRef.current.otherPlayers.find(p => p.id === clientId).score}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Render the app
const root = createRoot(document.getElementById('root'));
root.render(<App />);

