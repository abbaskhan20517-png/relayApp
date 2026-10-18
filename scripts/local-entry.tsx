import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../app/workspace';
import '../styles/relay.css';
createRoot(document.getElementById('root')!).render(<Workspace/>);
