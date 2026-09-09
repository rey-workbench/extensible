import { mount } from "svelte";
import "@/features";
import App from "./App.svelte";
import "@/styles/global.css";
import "./index.css";

const target = document.getElementById("app") ?? document.body;
mount(App, { target });
