import 'dotenv/config';
import { gemini } from '../src/lib/gemini';

const listModels = async () => {
  try {
    const response = await gemini.models.list();
    console.log('Available Models:');
    if (response.page) {
        response.page.forEach((model) => {
             console.log(`- ${model.name}`);
        });
    } else {
        console.log("No models found.");
    }
  } catch (error) {
    console.error('Failed to list models:', error);
  }
}

listModels();
