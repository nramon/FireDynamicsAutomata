////////////////////////////////////////////////////////////////////////////////
// Wildland fire spread dynamics simulator based on:
//
// Almeida, Rodolfo Maduro and Macau, Elbert E N, "Stochastic cellular automata
// model for wildland fire spread dynamics," Journal of physics. Conference
// series, vol. 285, p. 012038, 2011, doi: 10.1088/1742-6596/285/1/012038.
// 
// Copyright (C) 2020 Ramon Novoa ramonnovoa@gmail.com
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
////////////////////////////////////////////////////////////////////////////////
class FireDynamicsSimulator {

    ////////////////////////////////////////////////////////////////////////////
    // Constructor.
    ////////////////////////////////////////////////////////////////////////////
    constructor(canvas,
                vegetation_prob,
                burning_prob,
                burnt_prob,
                size,
                scale,
                sim_speed) {

        // Simulator properties.
        this.sim_speed = sim_speed;
        this.step_count = 0;
        this.timeout_id = null;
        this.wildland = new Wildland(
            canvas,
            vegetation_prob,
            burning_prob,
            burnt_prob,
            size,
            scale);

        // Start the simulation.
        this.wildland.reset();
        this.wildland.redraw();

        // Add a new fire when clicking on the canvas.
        document.getElementById(canvas).addEventListener('pointerdown',
            (event) => {

                // Get the coordinates of the click.
                let rect = document.getElementById(canvas).getBoundingClientRect();
                let x = event.clientX - rect.left
                let y = event.clientY - rect.top

                // Add the fire.
                this.wildland.add_fire(x,y);
            }
        );
    }

    ////////////////////////////////////////////////////////////////////////////
    // Setter for wildland.burning_prob.
    ////////////////////////////////////////////////////////////////////////////
    set_burning_prob(value) {
        this.wildland.burning_prob = value;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Setter for wildland.burnt_prob.
    ////////////////////////////////////////////////////////////////////////////
    set_burnt_prob(value) {
        this.wildland.burnt_prob = value;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Setter for sim_speed.
    ////////////////////////////////////////////////////////////////////////////
    set_sim_speed(value) {
        this.sim_speed = value;

        // If the simulation was running, restart at the new speed.
        if (this.timeout_id !== null) {
            this.stop();
            this.run();
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Setter for wildland.vegetation_prob.
    ////////////////////////////////////////////////////////////////////////////
    set_vegetation_prob(value) {
        this.wildland.vegetation_prob = value;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Reset the simulation.
    ////////////////////////////////////////////////////////////////////////////
    reset(keep_fires=false) {

        // Reset the step count.
        if (!keep_fires) {
            this.step_count = 0;
            document.getElementById("step_count").value = this.step_count;
        }

        // Reset the environment.
        this.wildland.reset(keep_fires);
        this.wildland.redraw();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Run a continuous simulation.
    ////////////////////////////////////////////////////////////////////////////
    run() {
        if (!this.timeout_id) {
            this.timeout_id = setInterval(() => {
                this.step();
            }, 1000 / this.sim_speed);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Run a simulation step.
    ////////////////////////////////////////////////////////////////////////////
    step() {

        // Update the step count.
        this.step_count += 1;
        document.getElementById("step_count").value = this.step_count;

        // Run a full sweep.
        this.wildland.sweep();
        this.wildland.redraw();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Stop a running simulation.
    ////////////////////////////////////////////////////////////////////////////
    stop() {
        if (this.timeout_id) {
            clearInterval(this.timeout_id);
            this.timeout_id = null;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Zoom in by a factor of 2.
    ////////////////////////////////////////////////////////////////////////////
    zoom_in() {
        this.wildland.rescale(2.0);
        this.wildland.redraw();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Zoom out by a factor of 2.
    ////////////////////////////////////////////////////////////////////////////
    zoom_out() {
        this.wildland.rescale(0.5);
        this.wildland.redraw();
    }
}

////////////////////////////////////////////////////////////////////////////////
// Class that models a square wildland environment.
////////////////////////////////////////////////////////////////////////////////
class Wildland {

    ////////////////////////////////////////////////////////////////////////////
    // Constructor.
    ////////////////////////////////////////////////////////////////////////////
    constructor(canvas="fire_dynamics",
                vegetation_prob,
                burning_prob,
                burnt_prob,
                size,
                scale) {

        // Wildland properties.
        this.burning_prob = burning_prob;
        this.burnt_prob = burnt_prob;
        this.scale = scale;
        this.size = size;
        this.vegetation_prob = vegetation_prob;

        // Cell types.
        this.empty      = "#2D1A19";
        this.burning    = "#EA4335";
        this.burnt      = "#646464";
        this.vegetation = "#009933";

        // Initialize the canvas.
        this.canvas = document.getElementById(canvas);
        this.canvas.width = size * scale;
        this.canvas.height = size * scale;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.scale(scale, scale);

        // Allocate the internal state.
        this.state = new Array(size);
        this.buffer = new Array(size);
        for (let x = 0; x < this.size; x++) {
            this.state[x] = new Array(this.size);
            this.buffer[x] = new Array(this.size);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Add a fire at location (x, y).
    ////////////////////////////////////////////////////////////////////////////
    add_fire(x, y, draw=true) {

        // Rescale x and y.
        x = Math.floor(x / this.scale)
        y = Math.floor(y / this.scale)

        // Only vegetation can burn.
        if (this.state[x][y] == this.vegetation) {
            this.state[x][y] = this.burning;

            // There is no need to redraw the whole canvas.
            if (draw) {
                this.ctx.fillStyle = this.burning;
                this.ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Spread fire in the Moore neighborhood.
    ////////////////////////////////////////////////////////////////////////////
    burn_neighborhood(x, y) {
        for (let i = x - 1; i <= x + 1; i++) {
            for (let j = y - 1; j <= y + 1; j++) {

                // Do not leave the canvas.
                if (i < 0 || i >= this.size ||
                    j < 0 || j >= this.size) {
                    continue;
                }

                // Burn with probability burning_prob.
                if (this.buffer[i][j] == this.vegetation &&
                    Math.random() < this.burning_prob / 100.0) {
                    this.state[i][j] = this.burning;
                }
            }
        } 
    }

    ////////////////////////////////////////////////////////////////////////////
    // Return the size of the canvas and its position relative to the viewport.
    ////////////////////////////////////////////////////////////////////////////
    get_bounding_rectangle() {
        return this.canvas.getBoundingClientRect();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Redraw the canvas from the internal state.
    ////////////////////////////////////////////////////////////////////////////
    redraw() {
        
        // Request a new frame for smooth animations.
        requestAnimationFrame(() => {

            // Freeze.
            this.ctx.save();

            // Update the canvas.
            for (let x = 0; x < this.size; x++) {
                for (let y = 0; y < this.size; y++) {
                    this.ctx.fillStyle = this.state[x][y];
                    this.ctx.fillRect(x, y, 1, 1);
                }
            }

            // Unfreeze.
            this.ctx.restore();
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Rescale canvas by a given factor.
    ////////////////////////////////////////////////////////////////////////////
    rescale(scale_factor) {
        this.scale *= scale_factor;
        this.canvas.width = this.size * this.scale;
        this.canvas.height = this.size * this.scale; 
        this.ctx.scale(this.scale, this.scale);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Generate a new simulator state.
    ////////////////////////////////////////////////////////////////////////////
    reset(keep_fires=false) {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {

                // Keep fires?
                if (keep_fires && (this.state[x][y] == this.burning ||
                    this.state[x][y] == this.burnt)) {
                    continue;
                }

                // Vegetation.
                if (Math.random() < this.vegetation_prob / 100.0) {
                    this.state[x][y] = this.vegetation;
                }
                // Empty space.
                else {
                    this.state[x][y] = this.empty;
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Run a complete sweep and update the internal state.
    ////////////////////////////////////////////////////////////////////////////
    sweep() {

        // Copy the state to the buffer.
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                this.buffer[x][y] = this.state[x][y];
            }
        }

        // Update the state.
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {

                // Burning cell.
                if (this.buffer[x][y] == this.burning) {

                    // Burn the neighborhood. It has the same effect as
                    // computing the cell's state from adjacent burning
                    // neighbors.
                    this.burn_neighborhood(x, y);

                    // Transition to burnt with probability burnt_prob.
                    if (Math.random() < this.burnt_prob / 100.0) {
                        this.state[x][y] = this.burnt;
                    }
                }
            }
        }
    }
}

