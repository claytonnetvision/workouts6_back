import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app = express();

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
} ));

app.use(express.json());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

// Get all workouts
app.get('/api/treinos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM treinos ORDER BY data DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching treinos:', error);
    res.status(500).json({ error: 'Failed to fetch treinos' });
  }
});

// Get workout by ID
app.get('/api/treinos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM treinos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Treino not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching treino:', error);
    res.status(500).json({ error: 'Failed to fetch treino' });
  }
});

// Create new workout
app.post('/api/treinos', async (req, res) => {
  try {
    const { data, dia_semana, foco_tecnico, secoes } = req.body;
    
    const result = await pool.query(
      'INSERT INTO treinos (data, dia_semana, foco_tecnico, criado_em, atualizado_em) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [data, dia_semana, foco_tecnico]
    );
    
    const treino_id = result.rows[0].id;
    
    // Insert sections
    if (secoes && Array.isArray(secoes)) {
      for (const secao of secoes) {
        await pool.query(
          'INSERT INTO secoes_treino (treino_id, nome_secao, duracao_minutos, conteudo, ordem, criado_em) VALUES ($1, $2, $3, $4, $5, NOW())',
          [treino_id, secao.nome_secao, secao.duracao_minutos, secao.conteudo, secao.ordem]
        );
      }
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating treino:', error);
    res.status(500).json({ error: 'Failed to create treino' });
  }
});

// Update workout
app.put('/api/treinos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, dia_semana, foco_tecnico, secoes } = req.body;
    
    const result = await pool.query(
      'UPDATE treinos SET data = $1, dia_semana = $2, foco_tecnico = $3, atualizado_em = NOW() WHERE id = $4 RETURNING *',
      [data, dia_semana, foco_tecnico, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Treino not found' });
    }
    
    // Delete old sections
    await pool.query('DELETE FROM secoes_treino WHERE treino_id = $1', [id]);
    
    // Insert new sections
    if (secoes && Array.isArray(secoes)) {
      for (const secao of secoes) {
        await pool.query(
          'INSERT INTO secoes_treino (treino_id, nome_secao, duracao_minutos, conteudo, ordem, criado_em) VALUES ($1, $2, $3, $4, $5, NOW())',
          [id, secao.nome_secao, secao.duracao_minutos, secao.conteudo, secao.ordem]
        );
      }
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating treino:', error);
    res.status(500).json({ error: 'Failed to update treino' });
  }
});

// Delete workout
app.delete('/api/treinos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete sections first
    await pool.query('DELETE FROM secoes_treino WHERE treino_id = $1', [id]);
    
    // Delete workout
    const result = await pool.query('DELETE FROM treinos WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Treino not found' });
    }
    
    res.json({ message: 'Treino deleted successfully' });
  } catch (error) {
    console.error('Error deleting treino:', error);
    res.status(500).json({ error: 'Failed to delete treino' });
  }
});

// Get sections for a workout
app.get('/api/treinos/:id/secoes', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM secoes_treino WHERE treino_id = $1 ORDER BY ordem', [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}` );
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});