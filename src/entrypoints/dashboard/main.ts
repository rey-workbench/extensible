import "@/features";
import "@/styles/global.css";
import { mount } from "svelte";
import App from "./App.svelte";
import "./index.css";

const target = document.getElementById("app") ?? document.body;
mount(App, { target });
