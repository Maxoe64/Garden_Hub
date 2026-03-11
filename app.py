from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import json
import os

app = Flask(__name__, static_folder='static')
CORS(app)

# Load seed data
with open(os.path.join(os.path.dirname(__file__), 'seed_data.json')) as f:
    SEED_DATA = json.load(f)

# Index knowledge base on startup
from rag_engine import ensure_indexed, chat as rag_chat, get_config as rag_get_config
ensure_indexed()


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


@app.route('/api/seeds')
def get_seeds():
    return jsonify(SEED_DATA)


@app.route('/api/seeds/<seed_id>')
def get_seed(seed_id):
    for seed in SEED_DATA['seeds']:
        if seed['id'] == seed_id:
            return jsonify(seed)
    return jsonify({'error': 'Seed not found'}), 404


@app.route('/api/guide', methods=['POST'])
def get_guide():
    data = request.json
    seed_id = data.get('seed_id')
    space = data.get('space', 'indoor')
    experience = data.get('experience', 'beginner')
    start_date = data.get('start_date', '')

    seed = None
    for s in SEED_DATA['seeds']:
        if s['id'] == seed_id:
            seed = s
            break

    if not seed:
        return jsonify({'error': 'Seed not found'}), 404

    guide = generate_guide(seed, space, experience, start_date)
    return jsonify(guide)


@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    """RAG-powered chat endpoint."""
    data = request.json
    message = data.get('message', '')
    history = data.get('history', [])
    provider = data.get('provider', None)
    model = data.get('model', None)
    use_web_search = data.get('use_web_search', None)

    if not message:
        return jsonify({'error': 'No message provided'}), 400

    result = rag_chat(
        message=message,
        conversation_history=history,
        provider=provider,
        model=model,
        use_web_search=use_web_search
    )
    return jsonify(result)


@app.route('/api/config')
def config_endpoint():
    """Return current AI configuration."""
    return jsonify(rag_get_config())


def generate_guide(seed, space, experience, start_date):
    """Generate a personalized growing guide."""
    guide = {
        'seed': seed,
        'space': space,
        'experience': experience,
        'start_date': start_date,
        'recommendations': [],
        'equipment': list(seed['equipment']),
        'steps': seed['growing_steps'],
        'tips': list(seed['tips'])
    }

    # Space-specific recommendations
    if space == 'indoor':
        guide['recommendations'].append(f"Grow your {seed['name'].lower()} in a {seed['spacing']['container_size']} container near your brightest window.")
        guide['recommendations'].append("Consider a grow light if you don't get 6+ hours of direct sun.")
        if not seed['temperature']['frost_tolerant']:
            guide['recommendations'].append("Great news — growing indoors means you can start any time!")
        guide['equipment'].append("Grow light (if window light is insufficient)")
        guide['equipment'].append("Saucer/tray for drainage")

    elif space == 'balcony':
        guide['recommendations'].append(f"Use a {seed['spacing']['container_size']} container with good drainage holes.")
        guide['recommendations'].append("Check your balcony's sun exposure — south-facing is ideal.")
        guide['recommendations'].append("Wind can dry out containers quickly — check soil moisture daily.")
        guide['equipment'].append("Wind protection (if exposed balcony)")

    elif space == 'small-yard':
        guide['recommendations'].append(f"Space plants {seed['spacing']['between_plants']} apart in your garden bed.")
        guide['recommendations'].append("Consider a raised bed for better soil control and drainage.")
        guide['equipment'].append("Garden bed or raised bed materials")
        guide['equipment'].append("Mulch for moisture retention")

    elif space == 'garden':
        guide['recommendations'].append(f"Space plants {seed['spacing']['between_plants']} apart, rows {seed['spacing']['between_rows']} apart.")
        guide['recommendations'].append("Rotate where you plant each year to prevent disease buildup.")
        guide['equipment'].append("Mulch")
        guide['equipment'].append("Soaker hose or drip irrigation (optional)")

    # Experience-specific tips
    if experience == 'beginner':
        guide['recommendations'].append("Don't worry about perfection — plants are resilient! Start simple and learn as you go.")
        guide['recommendations'].append("Check your local library for seed libraries and free gardening workshops.")
        guide['tips'].append("Take photos each week to track progress — it's motivating and helps you learn!")
        guide['tips'].append("Join a local gardening group or online community for support")

    elif experience == 'intermediate':
        guide['recommendations'].append("Try companion planting to boost yields and reduce pests naturally.")
        guide['tips'].append("Start a garden journal to track what works in your specific conditions")

    elif experience == 'advanced':
        guide['recommendations'].append("Consider saving seeds from your best plants for next season.")
        guide['recommendations'].append("Try succession planting for continuous harvest.")

    # Library resources
    guide['library_resources'] = [
        "Check your local library for a seed library — many offer free seeds!",
        "Many libraries have tool lending programs — borrow what you need",
        "Ask about Master Gardener programs at your local extension office",
        "Look for community garden plots if you need more growing space"
    ]

    return guide


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, port=port)
