/* ============================================================
   CONFIGURAÇÃO
   ------------------------------------------------------------
   1) Deixe apiUrl VAZIO enquanto testa: o site funciona 100%,
      mas as respostas ficam apenas neste navegador (localStorage).

   2) Para somar as respostas de TODAS as pessoas (Tela 3),
      publique o backend do Google Apps Script (arquivo
      backend/Code.gs) e cole a URL do Web App abaixo, entre aspas.

      Ex.: apiUrl: "https://script.google.com/macros/s/AKfy.../exec"

   Enquanto o site estiver rodando, você também pode informar a URL
   sem editar este arquivo, abrindo o site com:
       ?api=https://script.google.com/macros/s/..../exec
   (ela fica salva no navegador para as próximas visitas)
   ============================================================ */

window.APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbx3iX6kzYg6gUNwP0hV0CX6-Y6lGzmzKHxMyCoJVzXi7SzrD7KrRiyBUDk0m4DCpCQg/exec",
  spreadsheetName: "Respostas"
};
