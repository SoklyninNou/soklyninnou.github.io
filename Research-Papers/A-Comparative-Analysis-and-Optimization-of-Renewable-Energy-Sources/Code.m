% Defining the objective function
objFunc = @(x) -(2.27*x(1) + 0.82*x(2) + 0.7*x(3) + 1.85*x(4) + 1.85*x(5)) * ...
              (4.4*x(1) + 3.1*x(2) + 2.4*x(3) + 1.7*x(4) + 3.5*x(5)) * ...
              (2.02*x(1) + 2.99*x(2) + 2.24*x(3) + 0.85*x(4) + 2.74*x(5));
% Defining the inequality constraints
A = [0.52, 0.62, 0.35, 1, 1;
    -1, -0.1, -0.25, -0.1, -0.1;
    -0.75, -0.1, -0.1, -0.75, -0.75;
    -0.9, -0.9, -0.8, -0.1, -0.9;
    -0.75, -1, -0.75, -0.5, -1;
    -0.27, -0.9, -0.9, -0.1, -0.9;
    -1, -1, -0.5, -0.25, -0.75];
b = [0.61684; -0.364; -0.4031; -0.5662; -0.58675; -0.58767; -0.54725];
% Defining the equality constraint
Aeq = [1, 1, 1, 1, 1];
beq = 1;
lb = [0; 0; 0; 0; 0]; % Lowerbounds
ub = [Inf; Inf; Inf; Inf; Inf]; % Upperbounds
x0 = [0; 0; 0; 0; 0];  % Initial guesses
options = optimoptions('fmincon', 'Display', 'iter');  % Optional: display the iterative progress
[xOpt, fVal] = fmincon(objFunc, x0, A, b, Aeq, beq, lb, ub, [], options);
% Display the optimal solution and objective function value
disp("Optimal solution:");
disp(xOpt);
disp("Objective function value:");
disp(-fVal);
