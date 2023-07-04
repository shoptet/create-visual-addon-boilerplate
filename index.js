#!/usr/bin/env node
import { input } from '@inquirer/prompts';

const answer = await input({ message: 'Enter the Addon name' });

console.log(answer);