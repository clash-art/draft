import React from 'react';
import {createRoot} from 'react-dom/client';
import Workbench from './Workbench';
import {compatibilityHost} from './host-bridge';
// A browser panel is not assumed to expose a host bridge merely because it is in Codex.
const host=compatibilityHost(window);
createRoot(document.getElementById('root')).render(<Workbench host={host}/>);
