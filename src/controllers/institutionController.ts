import { Request, Response } from 'express';
import { Institution, Hotspot } from '../models';
import { Op } from 'sequelize';

export const getAllInstitutions = async (req: Request, res: Response) => {
  try {
    const institutions = await Institution.findAll({
      where: {
        domain: { [Op.ne]: 'safecampus.edu' }
      },
      attributes: ['id', 'name', 'domain', 'logo_url', 'center_lat', 'center_lng', 'zoom_level', 'boundary']
    });
    res.json(institutions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createInstitution = async (req: Request, res: Response) => {
  try {
    const { name, domain, logoUrl, center_lat, center_lng, zoom_level, boundary, hotspots, density } = req.body;

    if (!boundary || !Array.isArray(boundary) || boundary.length < 3) {
      return res.status(400).json({ message: 'Campus perimeter boundary (minimum 3 points) is required.' });
    }
    
    if (!hotspots || !Array.isArray(hotspots) || hotspots.length === 0) {
      return res.status(400).json({ message: 'At least one campus landmark is required.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const institution = await Institution.create({
      name,
      slug,
      domain,
      logo_url: logoUrl,
      center_lat,
      center_lng,
      zoom_level,
      boundary,
      config: { density: density || 'Standard' }
    });

    if (hotspots && Array.isArray(hotspots)) {
      for (const h of hotspots) {
        await Hotspot.create({
          institution_id: institution.id,
          label: h.label,
          zone: h.zone,
          lat: h.lat,
          lng: h.lng,
          intensity: h.intensity || 'landmark',
          count: h.count || 0,
          types: Array.isArray(h.types) ? h.types.join(', ') : (h.types || '')
        });
      }
    }

    res.status(201).json(institution);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getInstitutionHotspots = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authReq = req as any;
    
    // Only allow authenticated users to access hotspots of their own institution
    if (authReq.user && authReq.user.institutionId !== id) {
      return res.status(403).json({ message: 'Access denied to another institution\'s data' });
    }
    
    const hotspots = await Hotspot.findAll({
      where: { institution_id: id }
    });
    
    const formatted = hotspots.map(h => ({
      ...h.toJSON(),
      types: h.types.split(',').map((t: string) => t.trim())
    }));
    
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateInstitution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, domain, boundary, center_lat, center_lng, hotspots } = req.body;
    
    const institution = await Institution.findByPk(id as string);
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    // Compute center from boundary centroid if not provided
    let newCenterLat = center_lat;
    let newCenterLng = center_lng;
    if ((!newCenterLat || !newCenterLng) && boundary && Array.isArray(boundary) && boundary.length >= 3) {
      const pts = boundary as [number, number][];
      newCenterLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      newCenterLng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    }

    await institution.update({
      name,
      domain,
      boundary,
      ...(newCenterLat && { center_lat: newCenterLat }),
      ...(newCenterLng && { center_lng: newCenterLng }),
    });

    // Update hotspots if provided
    if (hotspots && Array.isArray(hotspots)) {
      // Clear existing hotspots for this institution
      await Hotspot.destroy({ where: { institution_id: id } });
      
      // Create new hotspots
      for (const h of hotspots) {
        await Hotspot.create({
          institution_id: id,
          label: h.label,
          zone: h.zone || 'General',
          lat: h.lat,
          lng: h.lng,
          intensity: h.intensity || 'landmark',
          count: h.count || 0,
          types: Array.isArray(h.types) ? h.types.join(', ') : (h.types || '')
        });
      }
    }
    
    // Notify all connected clients in this institution to refresh their map data
    const { emitToInstitution } = require('../lib/socket');
    emitToInstitution(id, 'institution-updated', {
      id,
      name: institution.name,
      boundary: institution.boundary,
      center_lat: institution.center_lat,
      center_lng: institution.center_lng
    });

    res.json(institution);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
