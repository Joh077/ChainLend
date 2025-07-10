import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LoanForm() {
  return (

    <div >
    <div className="p-6 bg-zinc-900 text-white rounded-lg space-y-6">
      {/* Montant */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-gray-300 text-sm">
          Montant (en USDC) *
        </Label>
        <Input
          id="amount"
          type="number"
          placeholder="ex : 10000"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
        />
        <p className="text-xs text-gray-400">
          Combien voulez-vous emprunter ?
        </p>
      </div>

      {/* Taux d'intérêt */}
      <div className="space-y-2">
        <Label htmlFor="interest" className="text-gray-300 text-sm">
          Taux d'intérêt souhaité *
        </Label>
        <Input
          id="interest"
          type="text"
          placeholder="ex : 8%"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
        />
        <p className="text-xs text-gray-400">
          minimum 5% / maximum 15%
        </p>
      </div>

      {/* Durée */}
      <div className="space-y-2">
        <Label htmlFor="duration" className="text-gray-300 text-sm">
          Durée (en jours) *
        </Label>
        <Select>
          <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-gray-500">
            <SelectValue placeholder="Select a verified email to display" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="7" className="text-white hover:bg-gray-700">30</SelectItem>
            <SelectItem value="14" className="text-white hover:bg-gray-700">90</SelectItem>
            <SelectItem value="30" className="text-white hover:bg-gray-700">183</SelectItem>
            <SelectItem value="60" className="text-white hover:bg-gray-700">365</SelectItem>
            <SelectItem value="90" className="text-white hover:bg-gray-700">1095</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-400">
          Durée de l'emprunt
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-gray-300 text-sm">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="ex : Pour mon futur appartement !"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500 resize-none"
          rows={3}
        />
        <p className="text-xs text-gray-400">
          Donner envie aux gens de vous prêter !
        </p>
      </div>

      {/* Submit Button */}
      <Button className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-4 rounded">
        Submit
      </Button>
    </div>

    
    </div>
  );
}