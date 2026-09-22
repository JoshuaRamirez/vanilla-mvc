import { TodoApplication } from './app.ts';

const app = new TodoApplication(document.getElementById('app')!).start();

// For poking at from the console: app.shell, [...app.components()], document.querySelector('main').component
Object.assign(window, { app });
